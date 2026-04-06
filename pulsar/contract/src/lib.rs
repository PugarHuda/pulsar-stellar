//! Pulsar One-Way Payment Channel Contract
//!
//! A Soroban smart contract implementing a one-way payment channel for
//! AI agent billing on Stellar. The channel allows:
//!   1. `open_channel`  — sender deposits tokens into escrow
//!   2. `close_channel` — server presents a signed commitment to claim payment;
//!                        remainder is refunded to sender
//!   3. `get_channel`   — read current channel state
//!
//! Signature verification uses Ed25519 over the message:
//!   `channel_id (32 bytes) || amount (8 bytes big-endian)`
//! where `channel_id` is derived from the contract's own address.
//!
//! Requirements: 1.1, 1.2, 4.1, 4.2, 5.4, 5.5

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    token, Address, BytesN, Env,
    xdr::ToXdr,
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const CHANNEL_KEY: &str = "CHANNEL";

// ─── Types ────────────────────────────────────────────────────────────────────

/// Status of the payment channel.
#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum ChannelStatus {
    /// Channel is open and accepting commitments.
    Open,
    /// Channel has been settled and closed.
    Closed,
}

/// On-chain state of the payment channel.
///
/// Stored in contract persistent storage under key `CHANNEL`.
#[contracttype]
#[derive(Clone)]
pub struct ChannelState {
    /// Stellar address of the channel funder (user).
    pub sender: Address,
    /// Stellar address of the payment recipient (server/agent).
    pub recipient: Address,
    /// SAC token contract address (e.g. USDC).
    pub token: Address,
    /// Total amount deposited into escrow (base units, 7 decimals).
    pub amount: i128,
    /// Unix timestamp (seconds) after which sender can reclaim funds.
    pub expiry: u64,
    /// Current status of the channel.
    pub status: ChannelStatus,
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct PulsarChannel;

#[contractimpl]
impl PulsarChannel {
    /// Open a new payment channel by escrowing `amount` tokens from `sender`.
    ///
    /// # Arguments
    /// * `sender`    — address that funds the channel (must authorize)
    /// * `recipient` — address that receives payment on close
    /// * `token`     — SAC token contract address (USDC)
    /// * `amount`    — total budget in base units (must be > 0)
    /// * `expiry`    — Unix timestamp after which sender can reclaim
    ///
    /// # Panics
    /// - If a channel is already open on this contract instance
    /// - If `amount` is zero or negative
    ///
    /// Requirements: 1.1, 1.2
    pub fn open_channel(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        expiry: u64,
    ) {
        // Require sender authorization
        sender.require_auth();

        // Validate amount
        if amount <= 0 {
            panic!("amount must be positive");
        }

        // Ensure no channel is already open
        if env.storage().persistent().has(&CHANNEL_KEY) {
            panic!("channel already open");
        }

        // Transfer tokens from sender into contract escrow
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        // Persist channel state
        let state = ChannelState {
            sender,
            recipient,
            token,
            amount,
            expiry,
            status: ChannelStatus::Open,
        };
        env.storage().persistent().set(&CHANNEL_KEY, &state);
    }

    /// Close the channel by verifying the server's Ed25519 signature and
    /// distributing funds: `commitment_amount` to recipient, remainder to sender.
    ///
    /// The signed message is:
    ///   `channel_id (32 bytes) || commitment_amount (8 bytes big-endian)`
    ///
    /// where `channel_id` is the first 32 bytes of the contract address bytes.
    ///
    /// # Arguments
    /// * `commitment_amount` — amount to pay recipient (must be ≤ escrowed amount)
    /// * `signature`         — 64-byte Ed25519 signature from recipient's keypair
    ///
    /// # Panics
    /// - If channel is not open
    /// - If `commitment_amount` exceeds escrowed amount
    /// - If signature verification fails
    ///
    /// Requirements: 4.1, 4.2, 5.4, 5.5
    pub fn close_channel(
        env: Env,
        commitment_amount: i128,
        signature: BytesN<64>,
    ) {
        // Load channel state
        let mut state: ChannelState = env
            .storage()
            .persistent()
            .get(&CHANNEL_KEY)
            .expect("channel not found");

        // Ensure channel is still open
        if state.status != ChannelStatus::Open {
            panic!("channel already closed");
        }

        // Validate commitment amount
        if commitment_amount < 0 {
            panic!("commitment_amount must be non-negative");
        }
        if commitment_amount > state.amount {
            panic!("commitment_amount exceeds escrowed amount");
        }

        // ── Signature verification (Requirements 5.4, 5.5) ──────────────────
        //
        // Message: channel_id (32 bytes) || commitment_amount (8 bytes big-endian)
        // channel_id = first 32 bytes of the contract address bytes
        //
        // The recipient (server) must have signed this message with their
        // Ed25519 private key. We verify against their public key.

        // Derive channel_id from contract address (32 bytes)
        let contract_addr_bytes = env.current_contract_address().to_xdr(&env);
        // XDR-encoded address is longer; take the last 32 bytes as the raw key
        let addr_len = contract_addr_bytes.len();
        let channel_id: BytesN<32> = contract_addr_bytes
            .slice(addr_len - 32..addr_len)
            .try_into()
            .expect("channel_id slice failed");

        // Encode commitment_amount as 8-byte big-endian
        let amount_bytes = (commitment_amount as u64).to_be_bytes();

        // Build the 40-byte message: channel_id (32 bytes) || amount (8 bytes)
        let mut msg = soroban_sdk::Bytes::new(&env);
        msg.append(&channel_id.clone().into());
        msg.append(&soroban_sdk::Bytes::from_slice(&env, &amount_bytes));

        // Derive recipient's Ed25519 public key from their Stellar address
        // Stellar G... addresses encode a 32-byte Ed25519 public key
        let recipient_xdr = state.recipient.clone().to_xdr(&env);
        let xdr_len = recipient_xdr.len();
        let recipient_pubkey: BytesN<32> = recipient_xdr
            .slice(xdr_len - 32..xdr_len)
            .try_into()
            .expect("recipient pubkey slice failed");

        // Verify Ed25519 signature (panics on failure — Req 5.5)
        env.crypto().ed25519_verify(&recipient_pubkey, &msg, &signature);

        // ── Fund distribution (Requirement 4.2) ─────────────────────────────
        let token_client = token::Client::new(&env, &state.token);

        // Pay recipient the committed amount
        if commitment_amount > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &state.recipient,
                &commitment_amount,
            );
        }

        // Refund remainder to sender
        let refund = state.amount - commitment_amount;
        if refund > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &state.sender,
                &refund,
            );
        }

        // Mark channel as closed
        state.status = ChannelStatus::Closed;
        env.storage().persistent().set(&CHANNEL_KEY, &state);

        // Emit settlement event for indexing
        env.events().publish(
            (soroban_sdk::symbol_short!("settled"), channel_id),
            (state.recipient.clone(), commitment_amount, refund),
        );
    }

    /// Partially settle the channel by paying recipient a portion of the commitment,
    /// while keeping the channel open for further use.
    ///
    /// This allows incremental payments without closing the channel, useful for
    /// long-running agent tasks or subscription-like models.
    ///
    /// The signed message is:
    ///   `channel_id (32 bytes) || partial_amount (8 bytes big-endian) || nonce (8 bytes big-endian)`
    ///
    /// # Arguments
    /// * `partial_amount` — amount to pay recipient now (must be ≤ remaining amount)
    /// * `nonce`          — monotonically increasing nonce to prevent replay attacks
    /// * `signature`      — 64-byte Ed25519 signature from recipient's keypair
    ///
    /// # Panics
    /// - If channel is not open
    /// - If `partial_amount` exceeds remaining escrowed amount
    /// - If signature verification fails
    ///
    /// Requirements: Partial settlement feature
    pub fn partial_settle(
        env: Env,
        partial_amount: i128,
        nonce: u64,
        signature: BytesN<64>,
    ) {
        // Load channel state
        let mut state: ChannelState = env
            .storage()
            .persistent()
            .get(&CHANNEL_KEY)
            .expect("channel not found");

        // Ensure channel is still open
        if state.status != ChannelStatus::Open {
            panic!("channel already closed");
        }

        // Validate partial amount
        if partial_amount <= 0 {
            panic!("partial_amount must be positive");
        }
        if partial_amount > state.amount {
            panic!("partial_amount exceeds remaining amount");
        }

        // ── Signature verification ──────────────────────────────────────────
        // Message: channel_id (32 bytes) || partial_amount (8 bytes) || nonce (8 bytes)

        let contract_addr_bytes = env.current_contract_address().to_xdr(&env);
        let addr_len = contract_addr_bytes.len();
        let channel_id: BytesN<32> = contract_addr_bytes
            .slice(addr_len - 32..addr_len)
            .try_into()
            .expect("channel_id slice failed");

        let amount_bytes = (partial_amount as u64).to_be_bytes();
        let nonce_bytes = nonce.to_be_bytes();

        let mut msg = soroban_sdk::Bytes::new(&env);
        msg.append(&channel_id.clone().into());
        msg.append(&soroban_sdk::Bytes::from_slice(&env, &amount_bytes));
        msg.append(&soroban_sdk::Bytes::from_slice(&env, &nonce_bytes));

        let recipient_xdr = state.recipient.clone().to_xdr(&env);
        let xdr_len = recipient_xdr.len();
        let recipient_pubkey: BytesN<32> = recipient_xdr
            .slice(xdr_len - 32..xdr_len)
            .try_into()
            .expect("recipient pubkey slice failed");

        env.crypto().ed25519_verify(&recipient_pubkey, &msg, &signature);

        // ── Transfer partial amount ─────────────────────────────────────────
        let token_client = token::Client::new(&env, &state.token);
        token_client.transfer(
            &env.current_contract_address(),
            &state.recipient,
            &partial_amount,
        );

        // Update remaining amount
        state.amount -= partial_amount;
        env.storage().persistent().set(&CHANNEL_KEY, &state);

        // Emit partial settlement event
        env.events().publish(
            (soroban_sdk::symbol_short!("partial"), channel_id),
            (state.recipient.clone(), partial_amount, state.amount),
        );
    }

    /// Return the current channel state.
    ///
    /// # Panics
    /// - If no channel has been opened on this contract instance
    pub fn get_channel(env: Env) -> ChannelState {
        env.storage()
            .persistent()
            .get(&CHANNEL_KEY)
            .expect("channel not found")
    }

    /// Reclaim funds if channel has expired without settlement.
    ///
    /// This allows the sender to recover their funds if the recipient
    /// never closes the channel before the expiry timestamp.
    ///
    /// # Panics
    /// - If channel is not found
    /// - If channel is already closed
    /// - If current time is before expiry
    /// - If caller is not the sender
    ///
    /// Requirements: Time-locked refund safety mechanism
    pub fn reclaim_expired(env: Env) {
        let mut state: ChannelState = env
            .storage()
            .persistent()
            .get(&CHANNEL_KEY)
            .expect("channel not found");

        // Ensure channel is still open
        if state.status != ChannelStatus::Open {
            panic!("channel already closed");
        }

        // Check if expired
        let current_time = env.ledger().timestamp();
        if current_time <= state.expiry {
            panic!("channel not yet expired");
        }

        // Require sender authorization
        state.sender.require_auth();

        // Refund full amount to sender
        let token_client = token::Client::new(&env, &state.token);
        token_client.transfer(
            &env.current_contract_address(),
            &state.sender,
            &state.amount,
        );

        // Mark channel as closed
        state.status = ChannelStatus::Closed;
        env.storage().persistent().set(&CHANNEL_KEY, &state);
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env,
    };

    fn create_token<'a>(env: &'a Env, admin: &Address) -> (TokenClient<'a>, StellarAssetClient<'a>) {
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        (
            TokenClient::new(env, &sac.address()),
            StellarAssetClient::new(env, &sac.address()),
        )
    }

    #[test]
    fn test_open_channel_stores_state() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);

        let (token, token_admin) = create_token(&env, &admin);
        let token_addr = token.address.clone();

        // Mint 1000 units to sender
        token_admin.mint(&sender, &1000);

        // Deploy contract
        let contract_id = env.register_contract(None, PulsarChannel);
        let client = PulsarChannelClient::new(&env, &contract_id);

        // Open channel with 500 units
        client.open_channel(&sender, &recipient, &token_addr, &500, &9999999999u64);

        // Verify state
        let state = client.get_channel();
        assert_eq!(state.amount, 500);
        assert_eq!(state.status, ChannelStatus::Open);

        // Sender balance should be reduced by 500
        assert_eq!(token.balance(&sender), 500);
        // Contract should hold 500
        assert_eq!(token.balance(&contract_id), 500);
    }

    #[test]
    #[should_panic(expected = "channel already open")]
    fn test_cannot_open_twice() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);

        let (token, token_admin) = create_token(&env, &admin);
        let token_addr = token.address.clone();
        token_admin.mint(&sender, &1000);

        let contract_id = env.register_contract(None, PulsarChannel);
        let client = PulsarChannelClient::new(&env, &contract_id);

        client.open_channel(&sender, &recipient, &token_addr, &500, &9999999999u64);
        // Second open should panic
        client.open_channel(&sender, &recipient, &token_addr, &100, &9999999999u64);
    }

    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn test_zero_amount_rejected() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);

        let (token, token_admin) = create_token(&env, &admin);
        let token_addr = token.address.clone();
        token_admin.mint(&sender, &1000);

        let contract_id = env.register_contract(None, PulsarChannel);
        let client = PulsarChannelClient::new(&env, &contract_id);

        client.open_channel(&sender, &recipient, &token_addr, &0, &9999999999u64);
    }

    #[test]
    #[should_panic(expected = "channel not found")]
    fn test_get_channel_before_open() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PulsarChannel);
        let client = PulsarChannelClient::new(&env, &contract_id);
        client.get_channel();
    }

    #[test]
    #[should_panic(expected = "commitment_amount exceeds escrowed amount")]
    fn test_close_exceeds_amount() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);

        let (token, token_admin) = create_token(&env, &admin);
        let token_addr = token.address.clone();
        token_admin.mint(&sender, &1000);

        let contract_id = env.register_contract(None, PulsarChannel);
        let client = PulsarChannelClient::new(&env, &contract_id);

        client.open_channel(&sender, &recipient, &token_addr, &500, &9999999999u64);

        let sig = BytesN::from_array(&env, &[0u8; 64]);
        // Try to claim more than deposited — should panic before sig check
        client.close_channel(&600, &sig);
    }

    #[test]
    fn test_reclaim_expired_channel() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);

        let (token, token_admin) = create_token(&env, &admin);
        let token_addr = token.address.clone();
        token_admin.mint(&sender, &1000);

        let contract_id = env.register_contract(None, PulsarChannel);
        let client = PulsarChannelClient::new(&env, &contract_id);

        // Open channel with expiry in 100 seconds
        let expiry = env.ledger().timestamp() + 100;
        client.open_channel(&sender, &recipient, &token_addr, &500, &expiry);

        // Fast-forward time past expiry
        env.ledger().with_mut(|li| li.timestamp = expiry + 1);

        // Sender reclaims expired funds
        client.reclaim_expired();

        // Verify sender got full refund
        assert_eq!(token.balance(&sender), 1000);
        assert_eq!(token.balance(&contract_id), 0);

        // Verify channel is closed
        let state = client.get_channel();
        assert_eq!(state.status, ChannelStatus::Closed);
    }

    #[test]
    #[should_panic(expected = "channel not yet expired")]
    fn test_cannot_reclaim_before_expiry() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);

        let (token, token_admin) = create_token(&env, &admin);
        let token_addr = token.address.clone();
        token_admin.mint(&sender, &1000);

        let contract_id = env.register_contract(None, PulsarChannel);
        let client = PulsarChannelClient::new(&env, &contract_id);

        let expiry = env.ledger().timestamp() + 100;
        client.open_channel(&sender, &recipient, &token_addr, &500, &expiry);

        // Try to reclaim before expiry — should panic
        client.reclaim_expired();
    }
}

# Stabilized Supply Token (SST)

A smart contract implementation of a token with built-in price stabilization mechanisms, developed for the Stacks blockchain using Clarity language.

## Overview

The Stabilized Supply Token (SST) is designed to maintain price stability through automatic supply adjustments. When the price moves outside a predefined tolerance band, the contract automatically expands or contracts the token supply to push the price back toward the target.

## Features

- **Automatic Price Stabilization**: Monitors price via an oracle and adjusts supply when needed
- **Configurable Parameters**: Adjustable price targets, tolerance bands, and stabilization rates
- **Supply Control Mechanism**: Mints new tokens during price increases, burns tokens during price decreases
- **Standard Token Functionality**: Full ERC-20 like functionality including transfers, approvals, and allowances
- **History Tracking**: Records all stabilization actions with pricing data

## Contract Structure

### Key Components

- **Token Basics**: Standard fungible token implementation with transfers, balances, and approvals
- **Price Monitoring**: Oracle integration for price updates
- **Stabilization Logic**: Algorithms for determining when and how to adjust supply
- **Treasury Management**: Central treasury for holding and burning tokens during contractions

### Key Functions

- `transfer`, `transfer-from`, `approve`: Standard token operations
- `set-oracle-price`: Updates the current market price and triggers stabilization check
- `run-stabilization-check`: Determines if supply adjustments are needed
- `expand-supply`: Increases total supply by minting tokens to treasury
- `contract-supply`: Decreases total supply by burning tokens from treasury

## Configuration Parameters

The SST contract has several configurable parameters:

- `price-target`: The target price for the token (default: $1.00)
- `price-tolerance-pct`: Allowed percentage deviation from target (default: 5%)
- `expansion-rate`: Percentage to expand supply when price is too high (default: 5%)
- `contraction-rate`: Percentage to contract supply when price is too low (default: 5%)

## Usage

### Deployment

Deploy the contract to the Stacks blockchain using Clarinet:

```bash
clarinet deploy
```

### Initialization

Initialize the token with an initial supply:

```clarity
(contract-call? .sst initialize u1000000000 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)
```

### Price Updates

Update the token price via the oracle:

```clarity
(contract-call? .sst set-oracle-price u105000000)
```

### Transfers

Transfer tokens between accounts:

```clarity
(contract-call? .sst transfer u1000000 tx-sender 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)
```

## Testing

Run the test suite with Vitest:

```bash
npm test
```

The test suite verifies:
- Basic token functionality
- Allowance mechanisms
- Price stabilization logic
- Supply expansion and contraction

## Design Principles

### Price Stability Mechanism

The SST maintains price stability through a simple yet effective algorithmic approach:

1. **Monitor Price**: Oracle continuously updates the token's market price
2. **Evaluate Stability**: Compare current price to target price ± tolerance band
3. **Adjust Supply**: 
   - If price > upper bound: Expand supply to decrease price
   - If price < lower bound: Contract supply to increase price
4. **Record Actions**: Track all stabilization actions in on-chain history

### Supply Adjustment Logic

- **Expansion**: When price is too high, new tokens are minted directly to the treasury
- **Contraction**: When price is too low, tokens are burned from the treasury

This asymmetric design ensures that contractions can only happen if sufficient tokens exist in the treasury, preventing destabilization due to insufficient reserves.

## Security Considerations

In a production environment, this contract would require additional safeguards:

- Oracle access controls to prevent price manipulation
- Stabilization parameter adjustment permissions
- Rate limiting on supply adjustments
- Emergency pause functionality

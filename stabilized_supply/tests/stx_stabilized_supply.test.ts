import { describe, expect, it } from "vitest";

// Mock implementation of the SST contract for testing
class SSTContract {
  constructor() {
    this.tokenName = "Stabilized Supply Token";
    this.tokenSymbol = "SST";
    this.tokenDecimals = 6;
    this.tokenSupply = 0;
    this.priceTarget = 100000000; // $1.00 in micro-cents (10^8)
    this.priceTolerance = 5; // 5% tolerance band
    this.expansionRate = 5; // 5% expansion rate
    this.contractionRate = 5; // 5% contraction rate
    this.oraclePrice = 100000000; // Initial price = $1.00
    this.treasuryAddress = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    this.currentEpoch = 0;
    
    this.balances = new Map();
    this.allowances = new Map();
    this.stabilizationHistory = new Map();
  }

  // Helper methods
  keyForAllowance(owner, spender) {
    return `${owner}:${spender}`;
  }

  // Read-only functions
  getName() {
    return this.tokenName;
  }

  getSymbol() {
    return this.tokenSymbol;
  }

  getDecimals() {
    return this.tokenDecimals;
  }

  getTotalSupply() {
    return this.tokenSupply;
  }

  getBalance(account) {
    return this.balances.get(account) || 0;
  }

  getAllowance(owner, spender) {
    const key = this.keyForAllowance(owner, spender);
    return this.allowances.get(key) || 0;
  }

  getCurrentPrice() {
    return this.oraclePrice;
  }

  getPriceTarget() {
    return this.priceTarget;
  }

  getToleranceBand() {
    return this.priceTolerance;
  }

  getCurrentEpoch() {
    return this.currentEpoch;
  }

  // Calculate if price is within the stability range
  isPriceStable() {
    const currentPrice = this.oraclePrice;
    const target = this.priceTarget;
    const tolerance = this.priceTolerance;
    const upperBound = target + (target * tolerance / 100);
    const lowerBound = target - (target * tolerance / 100);
    
    return currentPrice >= lowerBound && currentPrice <= upperBound;
  }

  // Public functions
  transfer(amount, sender, recipient) {
    if (this.getBalance(sender) < amount) {
      return { error: 2 }; // ERR-INSUFFICIENT-BALANCE
    }
    
    this.balances.set(sender, this.getBalance(sender) - amount);
    this.balances.set(recipient, (this.getBalance(recipient) || 0) + amount);
    
    return { value: true };
  }

  transferFrom(amount, sender, recipient, txSender) {
    const allowance = this.getAllowance(sender, txSender);
    
    if (allowance < amount) {
      return { error: 3 }; // ERR-INSUFFICIENT-ALLOWANCE
    }
    
    if (this.getBalance(sender) < amount) {
      return { error: 2 }; // ERR-INSUFFICIENT-BALANCE
    }
    
    const key = this.keyForAllowance(sender, txSender);
    this.allowances.set(key, allowance - amount);
    
    this.balances.set(sender, this.getBalance(sender) - amount);
    this.balances.set(recipient, (this.getBalance(recipient) || 0) + amount);
    
    return { value: true };
  }

  approve(spender, amount, txSender) {
    const key = this.keyForAllowance(txSender, spender);
    this.allowances.set(key, amount);
    
    return { value: true };
  }

  // Oracle price update
  setOraclePrice(newPrice) {
    this.oraclePrice = newPrice;
    const result = this.runStabilizationCheck();
    
    return result;
  }

  // Stabilization mechanism
  runStabilizationCheck() {
    const currentPrice = this.oraclePrice;
    const target = this.priceTarget;
    const tolerance = this.priceTolerance;
    const upperBound = target + (target * tolerance / 100);
    const lowerBound = target - (target * tolerance / 100);
    const epochNumber = this.currentEpoch + 1;
    
    if (currentPrice > upperBound) {
      // Price is too high - contract needs to expand supply
      return this.expandSupply(epochNumber);
    } else if (currentPrice < lowerBound) {
      // Price is too low - contract needs to contract supply
      return this.contractSupply(epochNumber);
    } else {
      // Price is within bounds - no action needed
      return { value: true };
    }
  }

  // Supply expansion - mint new tokens to treasury
  expandSupply(epoch) {
    const currentSupply = this.tokenSupply;
    const expansionAmount = Math.floor(currentSupply * this.expansionRate / 100);
    const treasury = this.treasuryAddress;
    
    this.tokenSupply = currentSupply + expansionAmount;
    this.balances.set(treasury, (this.getBalance(treasury) || 0) + expansionAmount);
    
    this.stabilizationHistory.set(epoch, {
      price: this.oraclePrice,
      action: "expansion",
      amount: expansionAmount
    });
    
    this.incrementEpoch();
    return { value: true };
  }

  // Supply contraction - burn tokens from treasury
  contractSupply(epoch) {
    const currentSupply = this.tokenSupply;
    const contractionAmount = Math.floor(currentSupply * this.contractionRate / 100);
    const treasury = this.treasuryAddress;
    const treasuryBalance = this.getBalance(treasury) || 0;
    
    if (contractionAmount > treasuryBalance) {
      return { error: 4 }; // ERR-STABILIZATION-FAILED
    }
    
    this.tokenSupply = currentSupply - contractionAmount;
    this.balances.set(treasury, treasuryBalance - contractionAmount);
    
    this.stabilizationHistory.set(epoch, {
      price: this.oraclePrice,
      action: "contraction",
      amount: contractionAmount
    });
    
    this.incrementEpoch();
    return { value: true };
  }

  // Increment the epoch counter
  incrementEpoch() {
    this.currentEpoch++;
  }

  // Get stabilization history for a specific epoch
  getEpochHistory(epoch) {
    return this.stabilizationHistory.get(epoch) || null;
  }

  // Initialize the token
  initialize(initialSupply, admin) {
    if (this.tokenSupply !== 0) {
      return { error: 1 }; // ERR-NOT-AUTHORIZED
    }
    
    this.tokenSupply = initialSupply;
    this.balances.set(admin, initialSupply);
    
    return { value: true };
  }
}

describe("Stabilized Supply Token (SST) Contract", () => {
  describe("Basic Token Functionality", () => {
    it("should have correct token details", () => {
      const contract = new SSTContract();
      expect(contract.getName()).toBe("Stabilized Supply Token");
      expect(contract.getSymbol()).toBe("SST");
      expect(contract.getDecimals()).toBe(6);
    });

    it("should initialize with the correct supply", () => {
      const contract = new SSTContract();
      const initialSupply = 1000000000; // 1 million tokens
      const adminAddress = "ST1111111111111111111111111111111111111111";
      
      contract.initialize(initialSupply, adminAddress);
      
      expect(contract.getTotalSupply()).toBe(initialSupply);
      expect(contract.getBalance(adminAddress)).toBe(initialSupply);
    });

    it("should handle transfers correctly", () => {
      const contract = new SSTContract();
      const initialSupply = 1000000000; // 1 million tokens
      const adminAddress = "ST1111111111111111111111111111111111111111";
      const recipientAddress = "ST2222222222222222222222222222222222222222";
      const transferAmount = 500000000; // 500k tokens
      
      contract.initialize(initialSupply, adminAddress);
      contract.transfer(transferAmount, adminAddress, recipientAddress);
      
      expect(contract.getBalance(adminAddress)).toBe(initialSupply - transferAmount);
      expect(contract.getBalance(recipientAddress)).toBe(transferAmount);
    });

    it("should prevent transfers with insufficient balance", () => {
      const contract = new SSTContract();
      const initialSupply = 1000000000; // 1 million tokens
      const adminAddress = "ST1111111111111111111111111111111111111111";
      const recipientAddress = "ST2222222222222222222222222222222222222222";
      const transferAmount = 2000000000; // 2 million tokens (more than supply)
      
      contract.initialize(initialSupply, adminAddress);
      const result = contract.transfer(transferAmount, adminAddress, recipientAddress);
      
      expect(result.error).toBe(2); // ERR-INSUFFICIENT-BALANCE
      expect(contract.getBalance(adminAddress)).toBe(initialSupply);
      expect(contract.getBalance(recipientAddress)).toBe(0);
    });
  });

  describe("Allowance and TransferFrom", () => {
    it("should set allowance correctly", () => {
      const contract = new SSTContract();
      const initialSupply = 1000000000; // 1 million tokens
      const adminAddress = "ST1111111111111111111111111111111111111111";
      const spenderAddress = "ST2222222222222222222222222222222222222222";
      const allowanceAmount = 500000000; // 500k tokens
      
      contract.initialize(initialSupply, adminAddress);
      contract.approve(spenderAddress, allowanceAmount, adminAddress);
      
      expect(contract.getAllowance(adminAddress, spenderAddress)).toBe(allowanceAmount);
    });

    it("should handle transferFrom correctly", () => {
      const contract = new SSTContract();
      const initialSupply = 1000000000; // 1 million tokens
      const adminAddress = "ST1111111111111111111111111111111111111111";
      const spenderAddress = "ST2222222222222222222222222222222222222222";
      const recipientAddress = "ST3333333333333333333333333333333333333333";
      const allowanceAmount = 500000000; // 500k tokens
      const transferAmount = 300000000; // 300k tokens
      
      contract.initialize(initialSupply, adminAddress);
      contract.approve(spenderAddress, allowanceAmount, adminAddress);
      contract.transferFrom(transferAmount, adminAddress, recipientAddress, spenderAddress);
      
      expect(contract.getBalance(adminAddress)).toBe(initialSupply - transferAmount);
      expect(contract.getBalance(recipientAddress)).toBe(transferAmount);
      expect(contract.getAllowance(adminAddress, spenderAddress)).toBe(allowanceAmount - transferAmount);
    });

    it("should prevent transferFrom with insufficient allowance", () => {
      const contract = new SSTContract();
      const initialSupply = 1000000000; // 1 million tokens
      const adminAddress = "ST1111111111111111111111111111111111111111";
      const spenderAddress = "ST2222222222222222222222222222222222222222";
      const recipientAddress = "ST3333333333333333333333333333333333333333";
      const allowanceAmount = 200000000; // 200k tokens
      const transferAmount = 300000000; // 300k tokens
      
      contract.initialize(initialSupply, adminAddress);
      contract.approve(spenderAddress, allowanceAmount, adminAddress);
      const result = contract.transferFrom(transferAmount, adminAddress, recipientAddress, spenderAddress);
      
      expect(result.error).toBe(3); // ERR-INSUFFICIENT-ALLOWANCE
      expect(contract.getBalance(adminAddress)).toBe(initialSupply);
      expect(contract.getBalance(recipientAddress)).toBe(0);
      expect(contract.getAllowance(adminAddress, spenderAddress)).toBe(allowanceAmount);
    });
  });

  describe("Price Stabilization Mechanism", () => {
    it("should identify when price is stable", () => {
      const contract = new SSTContract();
      
      // Price exactly at target
      expect(contract.isPriceStable()).toBe(true);
      
      // Price within upper bound (5% tolerance)
      contract.oraclePrice = 104900000; // $1.049
      expect(contract.isPriceStable()).toBe(true);
      
      // Price within lower bound (5% tolerance)
      contract.oraclePrice = 95100000; // $0.951
      expect(contract.isPriceStable()).toBe(true);
    });

    it("should identify when price is unstable", () => {
      const contract = new SSTContract();
      
      // Price above upper bound
      contract.oraclePrice = 105100000; // $1.051
      expect(contract.isPriceStable()).toBe(false);
      
      // Price below lower bound
      contract.oraclePrice = 94900000; // $0.949
      expect(contract.isPriceStable()).toBe(false);
    });

    it("should expand supply when price is too high", () => {
      const contract = new SSTContract();
      const initialSupply = 1000000000; // 1 million tokens
      const adminAddress = "ST1111111111111111111111111111111111111111";
      
      contract.initialize(initialSupply, adminAddress);
      
      // Set price above upper bound
      contract.oraclePrice = 106000000; // $1.06
      contract.runStabilizationCheck();
      
      const expectedExpansion = 50000000; // 5% of 1 million
      expect(contract.getTotalSupply()).toBe(initialSupply + expectedExpansion);
      expect(contract.getBalance(contract.treasuryAddress)).toBe(expectedExpansion);
      expect(contract.getCurrentEpoch()).toBe(1);
      
      const history = contract.getEpochHistory(1);
      expect(history).toBeTruthy();
      expect(history.action).toBe("expansion");
      expect(history.amount).toBe(expectedExpansion);
    });

    it("should contract supply when price is too low", () => {
      const contract = new SSTContract();
      const initialSupply = 1000000000; // 1 million tokens
      const adminAddress = "ST1111111111111111111111111111111111111111";
      const treasuryAmount = 100000000; // 100k tokens in treasury
      
      contract.initialize(initialSupply, adminAddress);
      
      // Put some tokens in treasury
      contract.transfer(treasuryAmount, adminAddress, contract.treasuryAddress);
      
      // Set price below lower bound
      contract.oraclePrice = 94000000; // $0.94
      contract.runStabilizationCheck();
      
      const expectedContraction = 50000000; // 5% of 1 million
      expect(contract.getTotalSupply()).toBe(initialSupply - expectedContraction);
      expect(contract.getBalance(contract.treasuryAddress)).toBe(treasuryAmount - expectedContraction);
      expect(contract.getCurrentEpoch()).toBe(1);
      
      const history = contract.getEpochHistory(1);
      expect(history).toBeTruthy();
      expect(history.action).toBe("contraction");
      expect(history.amount).toBe(expectedContraction);
    });

    it("should fail contraction if treasury has insufficient funds", () => {
      const contract = new SSTContract();
      const initialSupply = 1000000000; // 1 million tokens
      const adminAddress = "ST1111111111111111111111111111111111111111";
      const treasuryAmount = 10000000; // Only 10k tokens in treasury (less than needed)
      
      contract.initialize(initialSupply, adminAddress);
      
      // Put some tokens in treasury (but not enough)
      contract.transfer(treasuryAmount, adminAddress, contract.treasuryAddress);
      
      // Set price below lower bound
      contract.oraclePrice = 94000000; // $0.94
      const result = contract.runStabilizationCheck();
      
      expect(result.error).toBe(4); // ERR-STABILIZATION-FAILED
      expect(contract.getTotalSupply()).toBe(initialSupply);
      expect(contract.getBalance(contract.treasuryAddress)).toBe(treasuryAmount);
      expect(contract.getCurrentEpoch()).toBe(0); // Epoch unchanged
    });

    it("should not modify supply when price is stable", () => {
      const contract = new SSTContract();
      const initialSupply = 1000000000; // 1 million tokens
      const adminAddress = "ST1111111111111111111111111111111111111111";
      
      contract.initialize(initialSupply, adminAddress);
      
      // Set price within bounds
      contract.oraclePrice = 102000000; // $1.02
      contract.runStabilizationCheck();
      
      expect(contract.getTotalSupply()).toBe(initialSupply);
      expect(contract.getCurrentEpoch()).toBe(0); // Epoch unchanged
    });
  });
});
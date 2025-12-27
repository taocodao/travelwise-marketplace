// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for Base Sepolia testnet
 * Can be minted freely for testing
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private _decimals;
    
    constructor() ERC20("Mock USD Coin", "USDC") Ownable(msg.sender) {
        _decimals = 6; // USDC uses 6 decimals
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint tokens for testing
     * Anyone can mint in testnet
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @dev Faucet - get 100 USDC for testing
     */
    function faucet() external {
        _mint(msg.sender, 100 * 10**6); // 100 USDC with 6 decimals
    }
}

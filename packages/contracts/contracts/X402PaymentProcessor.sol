// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title X402PaymentProcessor
 * @dev Processes pay-per-use payments for MCP tool calls using USDC
 * Implements the X402 protocol for micropayments
 */
contract X402PaymentProcessor is Ownable, ReentrancyGuard {
    IERC20 public usdcToken;
    
    // Platform fee (1% = 100, 0.5% = 50)
    uint256 public platformFeeBps = 50; // 0.5%
    address public platformWallet;
    
    struct Payment {
        address userWallet;
        address serverWallet;
        uint256 amount;
        string toolName;
        string mcpServerId;
        uint256 timestamp;
        bytes32 txHash;
    }
    
    // Mapping of payment ID to Payment details
    mapping(bytes32 => Payment) public payments;
    
    // Server earnings tracking
    mapping(address => uint256) public serverEarnings;
    
    // User spending tracking
    mapping(address => uint256) public userSpending;
    
    // Events
    event PaymentProcessed(
        bytes32 indexed paymentId,
        address indexed userWallet,
        address indexed serverWallet,
        uint256 amount,
        string toolName,
        string mcpServerId
    );
    
    event EarningsWithdrawn(
        address indexed serverWallet,
        uint256 amount
    );
    
    event PlatformFeeUpdated(uint256 newFeeBps);
    
    constructor(address _usdcToken, address _platformWallet) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
        platformWallet = _platformWallet;
    }
    
    /**
     * @dev Process a payment for an MCP tool call
     * @param serverWallet The wallet address of the MCP server
     * @param amount The amount in USDC (with 6 decimals)
     * @param toolName The name of the tool being called
     * @param mcpServerId The ID of the MCP server
     */
    function processPayment(
        address serverWallet,
        uint256 amount,
        string memory toolName,
        string memory mcpServerId
    ) external nonReentrant returns (bytes32) {
        require(serverWallet != address(0), "Invalid server wallet");
        require(amount > 0, "Amount must be greater than 0");
        
        // Calculate platform fee
        uint256 platformFee = (amount * platformFeeBps) / 10000;
        uint256 serverAmount = amount - platformFee;
        
        // Transfer USDC from user to contract
        require(
            usdcToken.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );
        
        // Transfer platform fee
        if (platformFee > 0) {
            require(
                usdcToken.transfer(platformWallet, platformFee),
                "Platform fee transfer failed"
            );
        }
        
        // Transfer to server wallet
        require(
            usdcToken.transfer(serverWallet, serverAmount),
            "Server payment failed"
        );
        
        // Generate payment ID
        bytes32 paymentId = keccak256(
            abi.encodePacked(
                msg.sender,
                serverWallet,
                amount,
                toolName,
                block.timestamp
            )
        );
        
        // Store payment details
        payments[paymentId] = Payment({
            userWallet: msg.sender,
            serverWallet: serverWallet,
            amount: amount,
            toolName: toolName,
            mcpServerId: mcpServerId,
            timestamp: block.timestamp,
            txHash: bytes32(0) // Will be set by backend
        });
        
        // Update tracking
        serverEarnings[serverWallet] += serverAmount;
        userSpending[msg.sender] += amount;
        
        emit PaymentProcessed(
            paymentId,
            msg.sender,
            serverWallet,
            amount,
            toolName,
            mcpServerId
        );
        
        return paymentId;
    }
    
    /**
     * @dev Get server earnings
     */
    function getServerEarnings(address serverWallet) external view returns (uint256) {
        return serverEarnings[serverWallet];
    }
    
    /**
     * @dev Get user total spending
     */
    function getUserSpending(address userWallet) external view returns (uint256) {
        return userSpending[userWallet];
    }
    
    /**
     * @dev Get payment details
     */
    function getPayment(bytes32 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }
    
    /**
     * @dev Update platform fee (only owner)
     */
    function updatePlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee cannot exceed 10%");
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(newFeeBps);
    }
    
    /**
     * @dev Update platform wallet (only owner)
     */
    function updatePlatformWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid wallet");
        platformWallet = newWallet;
    }
    
    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = usdcToken.balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        require(
            usdcToken.transfer(owner(), balance),
            "Withdrawal failed"
        );
    }
}

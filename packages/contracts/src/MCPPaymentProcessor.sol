// contracts/MCPPaymentProcessor.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MCPPaymentProcessor is ReentrancyGuard, Ownable {
    IERC20 public usdcToken;
    
    // Events
    event PaymentProcessed(
        address indexed from,
        address indexed to,
        uint256 amount,
        string toolName,
        string mcpServer,
        uint256 timestamp
    );
    
    event ServerRegistered(
        address indexed serverAddress,
        string serverName
    );
    
    // MCP Server registry
    mapping(address => bool) public registeredServers;
    mapping(address => uint256) public serverEarnings;
    mapping(address => string) public serverNames;
    
    constructor(address _usdcTokenAddress) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcTokenAddress);
    }
    
    // Register MCP server
    function registerServer(address serverAddress, string memory serverName) 
        external 
        onlyOwner 
    {
        registeredServers[serverAddress] = true;
        serverNames[serverAddress] = serverName;
        emit ServerRegistered(serverAddress, serverName);
    }
    
    // Process payment for MCP call
    function processPayment(
        address serverAddress,
        uint256 amount,
        string memory toolName,
        string memory mcpServer
    ) external nonReentrant {
        require(registeredServers[serverAddress], "Server not registered");
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer USDC from user to server
        require(
            usdcToken.transferFrom(msg.sender, serverAddress, amount),
            "Transfer failed"
        );
        
        serverEarnings[serverAddress] += amount;
        
        emit PaymentProcessed(
            msg.sender,
            serverAddress,
            amount,
            toolName,
            mcpServer,
            block.timestamp
        );
    }
    
    // Batch payment for multiple MCP calls
    function batchPayment(
        address[] memory servers,
        uint256[] memory amounts,
        string[] memory toolNames,
        string[] memory mcpServers
    ) external nonReentrant {
        require(
            servers.length == amounts.length &&
            amounts.length == toolNames.length &&
            toolNames.length == mcpServers.length,
            "Array length mismatch"
        );
        
        for (uint i = 0; i < servers.length; i++) {
            require(registeredServers[servers[i]], "Server not registered");
            require(amounts[i] > 0, "Amount must be greater than 0");
            
            require(
                usdcToken.transferFrom(msg.sender, servers[i], amounts[i]),
                "Transfer failed"
            );
            
            serverEarnings[servers[i]] += amounts[i];
            
            emit PaymentProcessed(
                msg.sender,
                servers[i],
                amounts[i],
                toolNames[i],
                mcpServers[i],
                block.timestamp
            );
        }
    }
    
    // View functions
    function getServerEarnings(address serverAddress) 
        external 
        view 
        returns (uint256) 
    {
        return serverEarnings[serverAddress];
    }
    
    function isServerRegistered(address serverAddress) 
        external 
        view 
        returns (bool) 
    {
        return registeredServers[serverAddress];
    }
}

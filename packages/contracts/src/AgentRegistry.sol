// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentRegistry - ERC-8004 compliant AI agent identity registry
/// @notice Minimal implementation for TravelWise Marketplace
/// @dev Each agent is represented as an ERC-721 NFT with metadata URI
contract AgentRegistry is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    
    // Agent metadata stored on-chain
    mapping(uint256 => mapping(string => bytes)) public agentMetadata;
    
    // Agent wallet addresses
    mapping(uint256 => address) public agentWallets;
    
    // Agent reputation scores (0-100)
    mapping(uint256 => uint256) public agentReputation;
    
    // Total executions per agent
    mapping(uint256 => uint256) public totalExecutions;
    
    // Agent active status
    mapping(uint256 => bool) public isAgentActive;
    
    event AgentRegistered(
        uint256 indexed agentId,
        address indexed walletAddress,
        string tokenURI,
        uint256 timestamp
    );
    
    event MetadataSet(
        uint256 indexed agentId,
        string indexed key,
        bytes value
    );
    
    event AgentStatusChanged(
        uint256 indexed agentId,
        bool isActive
    );
    
    event ReputationUpdated(
        uint256 indexed agentId,
        uint256 newReputation
    );
    
    constructor() ERC721("TravelWise Agent", "TWAGENT") Ownable(msg.sender) {
        _tokenIdCounter = 1; // Start from 1
    }
    
    /// @notice Register a new AI agent
    /// @param walletAddress The agent's payment wallet address
    /// @param tokenURI IPFS/HTTP URI pointing to agent card JSON
    /// @return agentId The newly minted agent ID (NFT token ID)
    function registerAgent(
        address walletAddress,
        string memory tokenURI
    ) external onlyOwner returns (uint256) {
        require(walletAddress != address(0), "Invalid wallet address");
        require(bytes(tokenURI).length > 0, "Empty token URI");
        
        uint256 agentId = _tokenIdCounter++;
        
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, tokenURI);
        
        agentWallets[agentId] = walletAddress;
        agentMetadata[agentId]["agentWallet"] = abi.encode(walletAddress);
        agentMetadata[agentId]["registeredAt"] = abi.encode(block.timestamp);
        agentReputation[agentId] = 50; // Start with neutral reputation
        isAgentActive[agentId] = true;
        
        emit AgentRegistered(agentId, walletAddress, tokenURI, block.timestamp);
        
        return agentId;
    }
    
    /// @notice Set on-chain metadata for an agent
    /// @param agentId The agent's token ID
    /// @param key Metadata key (e.g., "description", "version")
    /// @param value Encoded metadata value
    function setMetadata(
        uint256 agentId,
        string memory key,
        bytes memory value
    ) external onlyOwner {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        
        agentMetadata[agentId][key] = value;
        
        emit MetadataSet(agentId, key, value);
    }
    
    /// @notice Get on-chain metadata
    /// @param agentId The agent's token ID
    /// @param key Metadata key
    /// @return Encoded metadata value
    function getMetadata(
        uint256 agentId,
        string memory key
    ) external view returns (bytes memory) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        return agentMetadata[agentId][key];
    }
    
    /// @notice Get agent wallet address
    /// @param agentId The agent's token ID
    /// @return The agent's payment wallet address
    function getAgentWallet(uint256 agentId) external view returns (address) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        return agentWallets[agentId];
    }
    
    /// @notice Update agent's active status
    /// @param agentId The agent's token ID
    /// @param active New active status
    function setAgentStatus(uint256 agentId, bool active) external onlyOwner {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        
        isAgentActive[agentId] = active;
        
        emit AgentStatusChanged(agentId, active);
    }
    
    /// @notice Update agent reputation score
    /// @param agentId The agent's token ID
    /// @param reputation New reputation score (0-100)
    function updateReputation(uint256 agentId, uint256 reputation) external onlyOwner {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        require(reputation <= 100, "Reputation must be 0-100");
        
        agentReputation[agentId] = reputation;
        
        emit ReputationUpdated(agentId, reputation);
    }
    
    /// @notice Increment execution counter for an agent
    /// @param agentId The agent's token ID
    function recordExecution(uint256 agentId) external {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        
        totalExecutions[agentId]++;
    }
    
    /// @notice Get total number of registered agents
    /// @return Total count of minted agent NFTs
    function totalAgents() external view returns (uint256) {
        return _tokenIdCounter - 1;
    }
    
    /// @notice Get full agent info
    /// @param agentId The agent's token ID
    /// @return wallet Agent's wallet address
    /// @return uri Token URI (metadata location)
    /// @return reputation Current reputation score
    /// @return executions Total executions
    /// @return active Active status
    function getAgentInfo(uint256 agentId) external view returns (
        address wallet,
        string memory uri,
        uint256 reputation,
        uint256 executions,
        bool active
    ) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        
        return (
            agentWallets[agentId],
            tokenURI(agentId),
            agentReputation[agentId],
            totalExecutions[agentId],
            isAgentActive[agentId]
        );
    }
    
    /// @notice Check if agent exists
    /// @param agentId The agent's token ID
    /// @return True if agent exists
    function agentExists(uint256 agentId) external view returns (bool) {
        return _ownerOf(agentId) != address(0);
    }
}

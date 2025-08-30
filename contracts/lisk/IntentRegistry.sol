/** SPDX-License-Identifier: MIT */
pragma solidity 0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IIntentRegistry.sol";

contract IntentRegistry is IIntentRegistry, Ownable, ReentrancyGuard {
    uint256 public nextRFQId = 1;
    mapping(uint256 => RFQ) public rfqs;
    
    uint256 public constant MIN_COMMIT_WINDOW = 30 seconds;
    uint256 public constant MAX_COMMIT_WINDOW = 1 hours;
    uint256 public constant MIN_REVEAL_WINDOW = 30 seconds;
    uint256 public constant MAX_REVEAL_WINDOW = 1 hours;
    
    uint256 public commitWindow = 5 minutes;
    uint256 public revealWindow = 5 minutes;
    
    event RFQCommitted(uint256 indexed rfqId, address indexed owner, address tokenIn, address tokenOut, uint256 amountIn, uint64 expiry);
    event RFQRevealed(uint256 indexed rfqId, uint256 amountIn, uint256 maxSlippageBps);
    event RFQExpired(uint256 indexed rfqId);
    
    enum RFQStatus { None, Committed, Revealed, Expired, Filled }
    
    constructor() Ownable(msg.sender) {}
    
    function commitRFQ(
        address tokenIn,
        address tokenOut,
        uint64 expiry,
        bytes32 commitment
    ) external nonReentrant returns (uint256 rfqId) {
        require(expiry > block.timestamp, "Intent expired");
        require(tokenIn != tokenOut, "Same token");
        require(tokenIn != address(0) && tokenOut != address(0), "Zero address");
        
        rfqId = nextRFQId++;
        rfqs[rfqId] = RFQ({
            owner: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            expiry: expiry,
            amountIn: 0,
            maxSlippageBps: 0,
            commitment: commitment,
            status: uint8(RFQStatus.Committed)
        });
        
        emit RFQCommitted(rfqId, msg.sender, tokenIn, tokenOut, 0, expiry);
    }
    
    function revealRFQ(
        uint256 rfqId,
        uint256 amountIn,
        uint256 maxSlippageBps,
        bytes32 salt
    ) external nonReentrant {
        RFQ storage rfq = rfqs[rfqId];
        require(rfq.owner == msg.sender, "Not owner");
        require(rfq.status == uint8(RFQStatus.Committed), "Not committed");
        require(block.timestamp <= rfq.expiry, "Intent expired");
        require(maxSlippageBps <= 10000, "Invalid slippage");
        
        bytes32 computedCommitment = keccak256(abi.encodePacked(amountIn, maxSlippageBps, salt));
        require(computedCommitment == rfq.commitment, "Invalid reveal");
        
        rfq.amountIn = amountIn;
        rfq.maxSlippageBps = maxSlippageBps;
        rfq.status = uint8(RFQStatus.Revealed);
        
        emit RFQRevealed(rfqId, amountIn, maxSlippageBps);
    }
    
    function expireRFQ(uint256 rfqId) external {
        RFQ storage rfq = rfqs[rfqId];
        require(block.timestamp > rfq.expiry, "Not expired");
        require(rfq.status != uint8(RFQStatus.Expired) && rfq.status != uint8(RFQStatus.Filled), "Already expired/filled");
        
        rfq.status = uint8(RFQStatus.Expired);
        emit RFQExpired(rfqId);
    }
    
    function markFilled(uint256 rfqId) external {
        RFQ storage rfq = rfqs[rfqId];
        require(rfq.status == uint8(RFQStatus.Revealed), "Not revealed");
        rfq.status = uint8(RFQStatus.Filled);
    }
    
    function getRFQ(uint256 rfqId) external view override returns (RFQ memory) {
        return rfqs[rfqId];
    }
    
    function setCommitWindow(uint256 _commitWindow) external onlyOwner {
        require(_commitWindow >= MIN_COMMIT_WINDOW && _commitWindow <= MAX_COMMIT_WINDOW, "Invalid window");
        commitWindow = _commitWindow;
    }
    
    function setRevealWindow(uint256 _revealWindow) external onlyOwner {
        require(_revealWindow >= MIN_REVEAL_WINDOW && _revealWindow <= MAX_REVEAL_WINDOW, "Invalid window");
        revealWindow = _revealWindow;
    }
}
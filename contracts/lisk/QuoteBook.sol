/** SPDX-License-Identifier: MIT */
pragma solidity 0.8.27;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IQuoteBook.sol";
import "./interfaces/IIntentRegistry.sol";

contract QuoteBook is IQuoteBook, ReentrancyGuard {
    IIntentRegistry public immutable intentRegistry;
    
    mapping(uint256 => IQuoteBook.Quote[]) public quotes;
    mapping(uint256 => uint256) public selectedQuoteIndex;
    mapping(uint256 => bool) public isSelectionMade;
    
    uint256 public constant QUOTE_COMMIT_WINDOW = 10 minutes;
    uint256 public constant QUOTE_REVEAL_WINDOW = 5 minutes;
    
    event QuoteCommitted(uint256 indexed rfqId, address indexed maker, bytes32 commitment);
    event QuoteRevealed(uint256 indexed rfqId, address indexed maker, uint256 quoteOut);
    event BestQuoteSelected(uint256 indexed rfqId, address indexed maker, uint256 quoteOut, uint256 quoteIndex);
    
    constructor(address _intentRegistry) {
        intentRegistry = IIntentRegistry(_intentRegistry);
    }
    
    function commitQuote(uint256 rfqId, bytes32 commitment) external override nonReentrant {
        IIntentRegistry.RFQ memory rfq = intentRegistry.getRFQ(rfqId);
        require(rfq.owner != address(0), "RFQ not found");
        require(rfq.status == 2, "RFQ not revealed");
        require(block.timestamp <= rfq.expiry, "RFQ expired");
        require(commitment != bytes32(0), "Empty commitment");
        
        quotes[rfqId].push(IQuoteBook.Quote({
            maker: msg.sender,
            quoteOut: 0,
            commitment: commitment,
            revealed: false,
            timestamp: block.timestamp
        }));
        
        emit QuoteCommitted(rfqId, msg.sender, commitment);
    }
    
    function revealQuote(uint256 rfqId, uint256 quoteOut, bytes32 salt) external override nonReentrant {
        IIntentRegistry.RFQ memory rfq = intentRegistry.getRFQ(rfqId);
        require(rfq.owner != address(0), "RFQ not found");
        require(rfq.status == 2, "RFQ not revealed");
        require(block.timestamp <= rfq.expiry, "RFQ expired");
        require(quoteOut > 0, "Invalid quote");
        
        IQuoteBook.Quote[] storage rfqQuotes = quotes[rfqId];
        bool found = false;
        
        for (uint256 i = 0; i < rfqQuotes.length; i++) {
            if (rfqQuotes[i].maker == msg.sender && !rfqQuotes[i].revealed) {
                bytes32 computedCommitment = keccak256(abi.encodePacked(quoteOut, salt));
                require(computedCommitment == rfqQuotes[i].commitment, "Invalid reveal");
                
                rfqQuotes[i].quoteOut = quoteOut;
                rfqQuotes[i].revealed = true;
                found = true;
                
                emit QuoteRevealed(rfqId, msg.sender, quoteOut);
                break;
            }
        }
        
        require(found, "No matching commitment");
    }
    
    function selectBest(
        uint256 rfqId,
        uint256 rngValue,
        bool isSecure,
        uint256 snapshotId,
        uint256 refPrice
    ) external override nonReentrant {
        IIntentRegistry.RFQ memory rfq = intentRegistry.getRFQ(rfqId);
        require(rfq.owner != address(0), "RFQ not found");
        require(rfq.status == 2, "RFQ not revealed");
        require(!isSelectionMade[rfqId], "Selection already made");
        require(isSecure, "RNG not secure");
        
        IQuoteBook.Quote[] storage rfqQuotes = quotes[rfqId];
        require(rfqQuotes.length > 0, "No quotes");
        
        uint256[] memory validQuoteIndices = new uint256[](rfqQuotes.length);
        uint256 validCount = 0;
        
        for (uint256 i = 0; i < rfqQuotes.length; i++) {
            if (rfqQuotes[i].revealed && rfqQuotes[i].quoteOut > 0) {
                uint256 slippage = _calculateSlippage(rfqQuotes[i].quoteOut, refPrice);
                if (slippage <= rfq.maxSlippageBps) {
                    validQuoteIndices[validCount] = i;
                    validCount++;
                }
            }
        }
        
        require(validCount > 0, "No valid quotes");
        
        uint256 selectedIndex = validQuoteIndices[rngValue % validCount];
        selectedQuoteIndex[rfqId] = selectedIndex;
        isSelectionMade[rfqId] = true;
        
        emit BestQuoteSelected(rfqId, rfqQuotes[selectedIndex].maker, rfqQuotes[selectedIndex].quoteOut, selectedIndex);
    }
    
    function getQuotes(uint256 rfqId) external view returns (IQuoteBook.Quote[] memory) {
        return quotes[rfqId];
    }
    
    function getSelectedQuote(uint256 rfqId) external view override returns (IQuoteBook.Quote memory) {
        require(isSelectionMade[rfqId], "No selection made");
        return quotes[rfqId][selectedQuoteIndex[rfqId]];
    }
    
    function _calculateSlippage(uint256 quoteOut, uint256 refPrice) internal pure returns (uint256) {
        if (refPrice == 0) return 0;
        if (quoteOut >= refPrice) return 0;
        return ((refPrice - quoteOut) * 10000) / refPrice;
    }
}
/** SPDX-License-Identifier: MIT */
pragma solidity 0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ISettlementVault.sol";
import "./interfaces/IIntentRegistry.sol";
import "./interfaces/IQuoteBook.sol";

contract SettlementVault is ISettlementVault, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    IIntentRegistry public immutable intentRegistry;
    IQuoteBook public immutable quoteBook;
    
    mapping(address => mapping(address => uint256)) public balances;
    mapping(uint256 => bool) public fulfilled;
    
    event Funded(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event FillCommitted(uint256 indexed rfqId, address indexed taker, address indexed maker, uint256 amountIn, uint256 amountOut);
    
    constructor(address _intentRegistry, address _quoteBook) Ownable(msg.sender) {
        intentRegistry = IIntentRegistry(_intentRegistry);
        quoteBook = IQuoteBook(_quoteBook);
    }
    
    function fund(address token, uint256 amount) external override nonReentrant {
        require(token != address(0), "Zero address");
        require(amount > 0, "Zero amount");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender][token] += amount;
        
        emit Funded(msg.sender, token, amount);
    }
    
    function withdraw(address token, uint256 amount) external override nonReentrant {
        require(token != address(0), "Zero address");
        require(amount > 0, "Zero amount");
        require(balances[msg.sender][token] >= amount, "Insufficient balance");
        
        balances[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, token, amount);
    }
    
    function fulfill(uint256 rfqId) external override nonReentrant {
        require(!fulfilled[rfqId], "Already fulfilled");
        
        IIntentRegistry.RFQ memory rfq = intentRegistry.getRFQ(rfqId);
        require(rfq.owner != address(0), "RFQ not found");
        require(rfq.status == 2, "RFQ not revealed");
        require(block.timestamp <= rfq.expiry, "RFQ expired");
        
        IQuoteBook.Quote memory selectedQuote = quoteBook.getSelectedQuote(rfqId);
        require(selectedQuote.maker != address(0), "No quote selected");
        require(selectedQuote.revealed, "Quote not revealed");
        
        require(balances[rfq.owner][rfq.tokenIn] >= rfq.amountIn, "Insufficient taker balance");
        require(balances[selectedQuote.maker][rfq.tokenOut] >= selectedQuote.quoteOut, "Insufficient maker balance");
        
        balances[rfq.owner][rfq.tokenIn] -= rfq.amountIn;
        balances[selectedQuote.maker][rfq.tokenOut] -= selectedQuote.quoteOut;
        
        balances[selectedQuote.maker][rfq.tokenIn] += rfq.amountIn;
        balances[rfq.owner][rfq.tokenOut] += selectedQuote.quoteOut;
        
        fulfilled[rfqId] = true;
        
        emit FillCommitted(rfqId, rfq.owner, selectedQuote.maker, rfq.amountIn, selectedQuote.quoteOut);
    }
    
    function getBalance(address user, address token) external view returns (uint256) {
        return balances[user][token];
    }
    
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(0), "Zero address");
        require(to != address(0), "Zero address");
        require(amount > 0, "Zero amount");
        
        IERC20(token).safeTransfer(to, amount);
    }
}
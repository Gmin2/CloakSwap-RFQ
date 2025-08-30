/** SPDX-License-Identifier: MIT */
pragma solidity 0.8.27;

interface IIntentRegistry {
  struct RFQ {
    address owner; address tokenIn; address tokenOut; uint64 expiry;
    uint256 amountIn; uint256 maxSlippageBps; bytes32 commitment; uint8 status;
  }
  function getRFQ(uint256 rfqId) external view returns (RFQ memory);
}
/** SPDX-License-Identifier: MIT */
pragma solidity 0.8.27;

interface ISettlementVault {
  function fund(address token, uint256 amount) external;
  function withdraw(address token, uint256 amount) external;
  function fulfill(uint256 rfqId) external;
}
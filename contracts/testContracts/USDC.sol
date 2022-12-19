pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDC is ERC20 {
    constructor(address owner) ERC20("USDC TEST", "USDC") {
        _mint(owner, 1000 * 10 ** decimals());
    }
}

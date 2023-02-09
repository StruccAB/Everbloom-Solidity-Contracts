// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/**
 * @title EverNFT
 * @author Everbloom
 * @notice Implementation of Everbloom NFT contract. This contract handles minting of NFTS
 * Ever NFT is link to a Drop created in EverDropManager smart contract
 */
interface IEverNFT {
    event NewPrintMinted(uint256 indexed dropId, uint256 indexed tokenId, uint128 serialNumber);

    /**
     * @notice
     *  Return the ineligibility reason for not minting NFT
     *
     * @param _to : address of the nft receiver
     * @param _dropId : drop identifier
     * @param _quantity : quantity to be minted
     * @param _capQuantity : cap quantity if greater then the max mint per address in WL
     * @param _proof : Merkle proof of the owner
     */
    function getIneligibilityReason(
        address _to,
        uint256 _dropId,
        uint128 _quantity,
        bool _capQuantity,
        bytes32[] calldata _proof
    ) external view returns (string memory);

    /**
     * @notice
     *  Let a user mint `_quantity` token(s) of the given `_dropId`
     *
     * @param _to : address of the nft receiver
     * @param _dropId : drop identifier
     * @param _quantity : quantity to be minted
         * @param _capQuantity : cap quantity if greater then the max mint per address in WL
     * @param _proof : Merkle proof of the owner
     */
    function mint(
        address _to,
        uint256 _dropId,
        uint128 _quantity,
        bool _capQuantity,
        bytes32[] calldata _proof
    ) external payable;

    /**
     * @notice
     *  pause the minting and transfer
     *  Only the contract owner can perform this operation
     */
    function pause() external;

    /**
     * @notice
     *  unpause the minting and transfer
     *  Only the contract owner can perform this operation
     */
    function unpause() external;

    /**
     * @notice
     *  Update the token Base URI
     *  Only the contract owner can perform this operation
     *
     * @param _newBaseURI : new base URI
     */
    function setBaseURI(string calldata _newBaseURI) external;

    /**
     * @notice
     *  Update the treasury address
     *  Only the contract owner can perform this operation
     *
     * @param _newTreasury : new treasury address
     */
    function setTreasury(address _newTreasury) external;
}

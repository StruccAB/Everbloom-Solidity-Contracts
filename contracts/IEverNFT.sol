// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/**
 * @title EverNFT
 * @author Everbloom
 * @notice Implementation of Everbloom NFT contract. This contract handles minting of NFTS
 * Ever NFT is link to a Drop created in EverDropManager smart contract
 */
interface IEverNFT {
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
     *  Return an array containing the token IDs owned by the given address
     *
     * @param _owner : owner address
     * @return result : array containing all the token IDs owned by `_owner`
     */
    function tokensOfOwner(address _owner) external view returns (uint256[] memory);

    /**
     * @notice
     *  Let a user mint `_quantity` token(s) of the given `_dropId`
     *
     * @param _to : address of the nft receiver
     * @param _dropId : drop identifier
     * @param _quantity : quantity to be minted
     * @param _externalIds : ids of the print in Everbloom platform
     * @param _proof : Merkle proof of the owner
     */
    function mint(
        address _to,
        uint256 _dropId,
        uint128 _quantity,
        string[] calldata _externalIds,
        bytes32[] calldata _proof
    ) external payable;
}

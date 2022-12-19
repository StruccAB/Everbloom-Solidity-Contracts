// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IEverDropManager2 {
    /**
     * @notice
     *  Drop Structure format
     *
     * @param dropId : drop unique identifier
     * @param sold : total number of sold tokens for this drop (accross all associated tokenId)
     * @param saleStartTime : opening timestamp of the sale
     * @param saleCloseTime : closing timestamp of the sale
     * @param tokenInfo : Token Info struct defining the token information (see TokenInfo structure)
     * @param externalId : id of the drop in legacy app
     * @param owner : right holder address
     * @param nft :  NFT contract address
     * @param merkleRoot : merkle root of the drop
     */
    struct Drop {
        uint256 dropId;
        uint128 sold;
        uint64 saleOpenTime;
        uint64 saleCloseTime;
        TokenInfo tokenInfo;
        string externalId;
        address owner;
        address nft;
        bytes32 merkleRoot;
    }

    /**
     * @notice
     *  TokenInfo Structure format
     *
     * @param price : initial price of 1 token
     * @param supply : total number of tokens for this drop (accross all associated tokenId)
     * @param royaltySharePerToken : total percentage of royalty evenly distributed among tokens holders
     */
    struct TokenInfo {
        // @change: what should be the currency
        uint256 price;
        uint128 supply;
        uint128 royaltySharePerToken;
    }

    // -------------------- Admin-Only Functions -------------------- //

    function addSubAdmin(address _creator) external;

    function removeSubAdmin(address _creator) external;

    // -------------------- Sub Admin-Only Functions -------------------- //

    function addCreator(address _creator) external;

    function removeCreator(address _creator) external;

    /**
     * @notice
     *  Update the Drop `_dropId` sale information
     *  Only the contract owner can perform this operation
     *
     * @param _dropId :  drop identifier of the drop to be updated
     * @param _saleOpenTime : opening timestamp of the sale
     * @param _saleCloseTime : closing timestamp of the sale
     */
    function updateDrop(uint _dropId, uint64 _saleOpenTime, uint64 _saleCloseTime) external;

    // -------------------- Creator-Only Functions -------------------- //

    /**
     * @notice
     *  Create a Drop
     *
     * @param _owner : right holder address
     * @param _nft : NFT contract address
     * @param _price : initial price of 1 NFT
     * @param _supply : total number of NFT for this drop (accross all associated tokenId)
     * @param _royaltySharePerToken : total percentage of royalty evenly distributed among NFT holders
     * @param _externalId : id of the print in legacy app
     * @param _saleOpenTime : opening timestamp of the sale
     * @param _saleCloseTime : closing timestamp of the sale
     * @param _merkle : merkle root of the drop
     */
    function create(
        address _owner,
        address _nft,
        uint256 _price,
        uint128 _supply,
        uint128 _royaltySharePerToken,
        string memory _externalId,
        uint64 _saleOpenTime,
        uint64 _saleCloseTime,
        bytes32 _merkle
    ) external;

    function updateDropCounter(uint256 _dropId, uint128 _quantity) external;

    /**
     * @notice
     *  Returns the drop `_dropId`
     *
     * @param _dropId : drop identifier
     */
    function drops(uint256 _dropId) external view returns (Drop memory);

    /**
     * @notice
     *  Returns the drop `_dropId`
     *
     * @param _dropId : drop identifier
     */
    function getDrop(uint _dropId) external view returns (Drop memory);

    /**
     * @notice
     *  Returns the drop by external id in legacy app
     *
     * @param _externalId : drop external identifier
     */
    function getDropByExternalId(string memory _externalId) external view returns (Drop memory);
}

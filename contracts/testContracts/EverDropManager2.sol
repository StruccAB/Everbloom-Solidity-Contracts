// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
// @chnage: follow pattern for const event function internal external
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import '@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165StorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "../IEverDropManager.sol";
import '../EverErrors.sol';
import '../IEverNFT.sol';

contract EverDropManager2 is Initializable, UUPSUpgradeable, AccessControlUpgradeable, ERC165StorageUpgradeable, EverErrors {
    event NewDrop(uint256 dropId, string externalId, address nftContractAddress);
    event DropSaleInfoUpdated(uint256 dropId, uint64 saleOpenTime, uint64 saleCloseTime);

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

    Drop[] public drops;
    mapping (string => uint256) public externalIdToDropId;
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    bytes32 public constant SUB_ADMIN_ROLE = keccak256("SUB_ADMIN_ROLE");

    /**
     * @notice
     *  EverNFT contract initialize function
     *
     * @param _admin : address of the NFT contract admin
     **/
    function initialize(address _admin) initializer public {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CREATOR_ROLE, _admin);
        _grantRole(SUB_ADMIN_ROLE, _admin);
        // register the IEverDropManager Interface
        _registerInterface(type(IEverDropManager).interfaceId);
    }

    // -------------------- Admin-Only Functions -------------------- //

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function addSubAdmin(address _creator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(SUB_ADMIN_ROLE, _creator);
    }

    function removeSubAdmin(address _creator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(SUB_ADMIN_ROLE, _creator);
    }

    // -------------------- Sub Admin-Only Functions -------------------- //

    function addCreator(address _creator) external onlyRole(SUB_ADMIN_ROLE) {
        _grantRole(CREATOR_ROLE, _creator);
    }

    function removeCreator(address _creator) external onlyRole(SUB_ADMIN_ROLE) {
        _revokeRole(CREATOR_ROLE, _creator);
    }

    function updateDrop(uint _dropId, uint64 _saleOpenTime, uint64 _saleCloseTime) external onlyRole(SUB_ADMIN_ROLE) {
        drops[_dropId].saleOpenTime = _saleOpenTime;
        drops[_dropId].saleCloseTime = _saleCloseTime;

        emit DropSaleInfoUpdated(_dropId, _saleOpenTime, _saleCloseTime);
    }

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
    ) external onlyRole(CREATOR_ROLE) {
        // @change: Update id generating logic and add more check

        uint dropId = drops.length;
        TokenInfo memory dropTokenInfo = TokenInfo(_price, _supply, _royaltySharePerToken);
        drops.push(Drop(dropId, 0, _saleOpenTime, _saleCloseTime, dropTokenInfo, _externalId, _owner, _nft, _merkle));
        externalIdToDropId[_externalId] = dropId;

        if (!ERC165CheckerUpgradeable.supportsInterface(_nft, type(IEverNFT).interfaceId))
            revert InvalidInterface();

        emit NewDrop(dropId, _externalId, _nft);
    }

    function updateDropCounter(uint256 _dropId, uint128 _quantity) external {
        Drop storage drop = drops[_dropId];

        // Ensure that the caller is the NFT contract associated to this drop
        if (msg.sender != drop.nft) revert UnauthorizedUpdate();

        drop.sold += _quantity;
    }

    /**
     * @notice
     *  Returns the drop `_dropId`
     *
     * @param _dropId : drop identifier
     */
    function getDrop(uint _dropId) external view returns (Drop memory) {
        return drops[_dropId];
    }

    /**
     * @notice
     *  Returns the drop by external id in legacy app
     *
     * @param _externalId : drop external identifier
     */
    function getDropByExternalId(string memory _externalId) external view returns (Drop memory) {
        return drops[externalIdToDropId[_externalId]];
    }

    /**
     * @dev See {ERC721Enumerable-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(AccessControlUpgradeable, ERC165StorageUpgradeable)
    returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

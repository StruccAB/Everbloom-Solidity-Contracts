// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165StorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "./IEverDropManager.sol";
import "./IEverNFT.sol";
import "./EverErrors.sol";

/**
 * @title EverNFT
 * @author Everbloom
 * @notice Implementation of Everbloom NFT contract. This contract handles minting of NFTS
 * Ever NFT is link to a Drop created in EverDropManager smart contract
 */
contract EverNFT is
    EverErrors,
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ERC721PausableUpgradeable,
    ERC721EnumerableUpgradeable,
    ERC165StorageUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;

    event NewPrintMinted(uint256 indexed dropId, uint256 indexed tokenId, string externalId, uint128 serialNumber);

    // @dev Stores the counter for NFT id
    CountersUpgradeable.Counter private _tokenIds;
    // @dev Store the base uri used for NFT metadata standard
    string public baseTokenURI;
    // @dev store the address of the Drop Manager
    address public dropManager;
    // @dev store the address of the Ever fund collector Multi-sig wallet
    address public treasury;
    // @dev store the address of the supported ERC20 token
    address public erc20tokenAddress;
    // @dev stores the Mapping (Token ID) => Drop ID
    mapping(uint256 => uint256) public tokenIdToDropId;
    // @dev stores the Mapping (Everbloom ID) => Token ID
    mapping(string => uint256) public externalIdToTokenId;

    // -------------------- Initializer Functions -------------------- //

    /**
     * @notice
     *  EverNFT contract initialize function
     *
     * @param _dropManager : address of the drop manager contract
     * @param _erc20tokenAddress : address of the ERC 20 contract
     * @param _treasury : address of the Ever fund collector Multi-sig wallet
     * @param _baseURI : base uri of the tokens
     * @param _name : name of the NFT contract
     * @param _symbol : symbol of the NFT contract
     **/
    function initialize(
        address _dropManager,
        address _erc20tokenAddress,
        address _treasury,
        string memory _baseURI,
        string memory _name,
        string memory _symbol
    )
    public
    initializer
    {
        __UUPSUpgradeable_init();
        __ERC721_init(_name, _symbol);
        __Ownable_init();
        if (!ERC165CheckerUpgradeable.supportsInterface(
            _dropManager,
            type(IEverDropManager).interfaceId
        )) revert InvalidInterface();

        baseTokenURI = _baseURI;
        dropManager = _dropManager;
        erc20tokenAddress = _erc20tokenAddress;
        treasury = _treasury;
        // register the IEverNFT Interface
        _registerInterface(type(IEverNFT).interfaceId);
    }

    // -------------------- Public Functions -------------------- //

    /**
     * @dev See {ERC165StorageUpgradeable-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC165StorageUpgradeable)
    returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // -------------------- External Functions -------------------- //

    /**
     * @notice
     *  Return an array containing the token IDs owned by the given address
     *
     * @param _owner : owner address
     * @return result : array containing all the token IDs owned by `_owner`
     */
    function tokensOfOwner(address _owner)
    external
    view
    returns (uint256[] memory)
    {
        uint256 tokenCount = balanceOf(_owner);
        // If _owner doesnt own any tokens, return an empty array
        if (tokenCount == 0) {
            return new uint256[](0);
        } else {
            uint256[] memory result = new uint256[](tokenCount);
            for (uint256 index = 0; index < tokenCount; ++index) {
                result[index] = tokenOfOwnerByIndex(_owner, index);
            }
            return result;
        }
    }

    /**
     * @notice
     *  Return the ineligibility reason for not minting NFT
     *
     * @param _to : address of the nft receiver
     * @param _dropId : drop identifier
     * @param _quantity : quantity to be minted
     * @param _externalIds : ids of the print in Everbloom platform
     * @param _proof : Merkle proof of the owner
     */
    function getIneligibilityReason(
        address _to,
        uint256 _dropId,
        uint128 _quantity,
        string[] calldata _externalIds,
        bytes32[] calldata _proof
    )
    external
    view
    returns (string memory)
    {
        IEverDropManager.Drop memory drop = IEverDropManager(dropManager).getDrop(_dropId);

        // Check if the drop is not sold-out
        if (drop.sold == drop.tokenInfo.supply) return 'DropSoldOut';
        // Check that there are enough tokens available for sale
        if (drop.sold + _quantity > drop.tokenInfo.supply)
            return 'NotEnoughTokensAvailable';
        if (_quantity != _externalIds.length) {
            return 'IncorrectExternalIds';
        }
        // Check if the drop sale is started
        if (block.timestamp < drop.saleOpenTime) {
            if (drop.merkleRoot == 0x0)
                return 'SaleNotStarted';

            bool isWhitelisted = MerkleProof.verify(
                _proof,
                drop.merkleRoot,
                keccak256(bytes.concat(keccak256(abi.encode(_to))))
            );

            if (!isWhitelisted)
                return 'NotWhiteListed';
        }
        // Check if the drop sale is ended
        if (block.timestamp > drop.saleCloseTime)
            return 'SaleEnded';

        for (uint128 i = 0; i < _quantity; ++i) {
            if (externalIdToTokenId[_externalIds[i]] != 0)
                return 'PrintConflict';
        }

        return '';
    }

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
    )
    external
    payable
    whenNotPaused
    {
        IEverDropManager.Drop memory drop = IEverDropManager(dropManager).getDrop(_dropId);

        // Check if the drop is not sold-out
        if (drop.sold == drop.tokenInfo.supply) revert DropSoldOut();
        // Check that there are enough tokens available for sale
        if (drop.sold + _quantity > drop.tokenInfo.supply)
            revert NotEnoughTokensAvailable();
        if (_quantity != _externalIds.length) {
            revert IncorrectExternalIds();
        }
        // Check if the drop sale is started
        if (block.timestamp < drop.saleOpenTime) {
            if (drop.merkleRoot == 0x0)
                revert SaleNotStarted();

            bool isWhitelisted = MerkleProof.verify(
                _proof,
                drop.merkleRoot,
                keccak256(bytes.concat(keccak256(abi.encode(_to))))
            );

            if (!isWhitelisted)
                revert NotWhiteListed();
        }
        // Check if the drop sale is ended
        if (block.timestamp > drop.saleCloseTime)
            revert SaleEnded();
        if (drop.tokenInfo.price > 0) {
            // Check that user has sufficient balance
            if (IERC20(erc20tokenAddress).balanceOf(msg.sender) < drop.tokenInfo.price * _quantity)
                revert InsufficientBalance();

            // Check that user has approved sufficient balance
            if (IERC20(erc20tokenAddress).allowance(msg.sender, address(this)) < drop.tokenInfo.price * _quantity)
                revert IncorrectAmountSent();
        }

        for (uint128 i = 0; i < _quantity; ++i) {
            if (externalIdToTokenId[_externalIds[i]] != 0)
                revert PrintConflict(_externalIds[i]);
            _tokenIds.increment();

            uint256 newItemId = _tokenIds.current();
            tokenIdToDropId[newItemId] = drop.dropId;
            _safeMint(_to, newItemId);
            externalIdToTokenId[_externalIds[i]] = newItemId;

            emit NewPrintMinted(drop.dropId, newItemId, _externalIds[i], drop.sold + i + 1);
        }

        IEverDropManager(dropManager).updateDropCounter(drop.dropId, _quantity);

        // transfer Fee to the treasury address
        if (drop.tokenInfo.price > 0) {
            IERC20(erc20tokenAddress).transferFrom(msg.sender, treasury, drop.tokenInfo.price * _quantity);
        }
    }

    // -------------------- Internal Functions -------------------- //

    /**
     * @dev See {ERC721Enumerable-beforeTokenTransfer}.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    )
    internal
    override(ERC721PausableUpgradeable, ERC721EnumerableUpgradeable)
    whenNotPaused
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    /**
     * @dev see {ERC721Upgradeable-baseURI}
     */
    function _baseURI()
    internal
    view
    override
    returns (string memory)
    {
        return baseTokenURI;
    }

    // -------------------- Admin-Only Functions -------------------- //

    /**
     * @dev See {UUPSUpgradeable-_authorizeUpgrade}.
     */
    function _authorizeUpgrade(address)
    internal
    override
    onlyOwner
    {}

    /**
     * @notice
     *  pause the minting and transfer
     *  Only the contract owner can perform this operation
     */
    function pause()
    external
    onlyOwner
    whenNotPaused
    {
        _pause();
    }

    /**
     * @notice
     *  unpause the minting and transfer
     *  Only the contract owner can perform this operation
     */
    function unpause()
    external
    onlyOwner
    whenPaused
    {
        _unpause();
    }

    /**
     * @notice
     *  Update the token Base URI
     *  Only the contract owner can perform this operation
     *
     * @param _newBaseURI : new base URI
     */
    function setBaseURI(string calldata _newBaseURI)
    external
    onlyOwner
    {
        baseTokenURI = _newBaseURI;
    }

    /**
     * @notice
     *  Update the treasury address
     *  Only the contract owner can perform this operation
     *
     * @param _newTreasury : new treasury address
     */
    function setTreasury(address _newTreasury)
    external
    onlyOwner
    {
        if (_newTreasury == address(0))
            revert InvalidAddress();
        treasury = _newTreasury;
    }

    /**
     * @notice
     *  Update the ERC20 token Address
     *  Only the contract owner can perform this operation
     *
     * @param _erc20tokenAddress : new ERC20 token Address
     */
    function setERC20TokenAddress(address _erc20tokenAddress)
    external
    onlyOwner
    {
        erc20tokenAddress = _erc20tokenAddress;
    }
}

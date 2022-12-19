// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

contract EverErrors {
    /**
    @notice Error returned if  the address is the zero address
    **/
    error ZeroAddress();

    /**
    @notice Error returned if the interface is not supported
    **/
    error InvalidInterface();

    /**
    @notice Error returned if the interface is not supported
    **/
    error InvalidAddress();

    /**
    @notice Error returned if the call is made from unauthorized source
    **/
    error UnauthorizedUpdate();

    /**
    @notice Error returned if the supply is zero
    **/
    error InvalidSupply();

    /**
    @notice Error returned if the external id of the drop is conflicting
    **/
    error DropConflict(
        string externalId
    );

    /**
    @notice Error returned if the quantity does not match externalIds
    **/
    error IncorrectExternalIds();

    /**
    @notice Error returned if the drop is sold-out
    **/
    error DropSoldOut();

    /**
    @notice Error returned if the sale has not started yet
    **/
    error SaleNotStarted();

    /**
    @notice Error returned if the sale has ended
    **/
    error SaleEnded();

    /**
    @notice Error returned if the address is not whitelisted
    **/
    error NotWhiteListed();

    /**
    @notice Error returned if the supply is sold out
    **/
    error NotEnoughTokensAvailable();

    /**
    @notice Error returned if user did not send the correct amount
    **/
    error IncorrectAmountSent();

    /**
    @notice Error returned if user had insufficient balance
    **/
    error InsufficientBalance();

    /**
    @notice Error returned if the external id of the print is conflicting
    **/
    error PrintConflict(
        string externalId
    );
}

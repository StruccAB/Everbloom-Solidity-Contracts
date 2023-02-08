import { expect } from "chai";
import {ethers} from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import {
  approveToken,
  BASE_URI, createDrop,
  deployContracts,
  getIneligibilityMintNFTs,
  mintNFTs,
  NFT_NAME,
  NFT_PRICE,
  NFT_SYMBOL, transferToken,
} from "./util";

describe("Ever NFT", function () {
  describe("Deployment", function () {
    it("Should set init states", async function () {
      const { everNFT } = await loadFixture(deployContracts);

      expect(await everNFT.paused()).to.equal(false);
      expect(await everNFT.tokenIdToDropId.length).to.equal(0);
      expect(await everNFT.name()).to.equal(NFT_NAME);
      expect(await everNFT.symbol()).to.equal(NFT_SYMBOL);
    });
  });

  describe("Pausable", function () {
    describe("Validations", function () {
      it("Should pause the contract when called by admin", async function () {
        const { everNFT } = await loadFixture(deployContracts);

        await expect(await everNFT.pause()).to.be.not.reverted;
        await expect(await everNFT.paused()).to.equal(true);
      });

      it("Should unpause the contract when called by admin", async function () {
        const { everNFT } = await loadFixture(deployContracts);
        await everNFT.pause()

        await expect(await everNFT.unpause()).to.be.not.reverted;
        await expect(await everNFT.paused()).to.equal(false);
      });

      it("Should not pause the contract when called by other roles", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, user1 } = await loadFixture(deployContracts);
        await Promise.all([
          everDropManager.grantRole(everDropManager.CREATOR_ROLE(), creator1.address),
          everDropManager.grantRole(everDropManager.SUB_ADMIN_ROLE(), subAdmin1.address),
        ])

        await expect(everNFT.connect(subAdmin1).pause()).to.be.reverted;
        await expect(everNFT.connect(creator1).pause()).to.be.reverted;
        await expect(everNFT.connect(user1).pause()).to.be.reverted;
        await expect(await everNFT.paused()).to.equal(false);
      });

      it("Should not unpause the contract when called by other roles", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, user1 } = await loadFixture(deployContracts);
        await Promise.all([
            everNFT.pause(),
          everDropManager.grantRole(everDropManager.CREATOR_ROLE(), creator1.address),
          everDropManager.grantRole(everDropManager.SUB_ADMIN_ROLE(), subAdmin1.address),
        ])

        await expect(everNFT.connect(subAdmin1).unpause()).to.be.reverted;
        await expect(everNFT.connect(creator1).unpause()).to.be.reverted;
        await expect(everNFT.connect(user1).unpause()).to.be.reverted;
        await expect(await everNFT.paused()).to.equal(true);
      });
    });
  });

  describe("NFT", function () {
    describe("Validations", function () {
      it("Should mint an NFT when called by a user", async function () {
        const { everDropManager, everNFT, owner, user1, usdc } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address);
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        let dropNftSold = drop[1];
        const quantity = 1;
        const amount = NFT_PRICE * quantity;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        await expect(dropNftSold).to.equal(0);
        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.not.reverted;
        await expect((await everNFT.balanceOf(user1.address))).to.equal(1);
        await expect(
            await everNFT.tokenIdToDropId(
                Number((await everNFT.tokenOfOwnerByIndex(user1.address, 0)))
            )
        ).to.equal(dropId);
        await expect(
            await everNFT.tokenURI(1)
        ).to.equal(BASE_URI + 1);
        await expect((await everDropManager.drops(0))[1]).to.equal(1)
      });

      it("Should mint an NFT without paying when drop is free", async function () {
        const { everDropManager, everNFT, usdc, owner, user1 } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address, { price: 0 });
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const quantity = 1;
        const amount = 0;

        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.not.reverted;
      });

      it("Should mint multiple NFT when called by a user", async function () {
        const { everDropManager, everNFT, owner, user1, usdc } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address);
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        let dropNftSold = drop[1];
        const quantity = 2;
        const amount = NFT_PRICE * quantity;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        await expect(dropNftSold).to.equal(0)
        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.not.reverted;

        await expect((await everNFT.balanceOf(user1.address))).to.equal(2);
        await expect((await everDropManager.drops(0))[1]).to.equal(2);
      });

      it("Should mint an NFT when sale is not started and user is in merkle root", async function () {
        const { everDropManager, everNFT, usdc, owner, user1, user2 } = await loadFixture(deployContracts);
        const merkleTree = StandardMerkleTree.of(
            [[user1.address], [owner.address], [user2.address]],
            ['address']
        );
        await createDrop(everDropManager, everNFT, owner, usdc.address, {
          saleOpenTime: Math.floor(new Date('2098-1-1').getTime() / 1000),
          merkleRoot: merkleTree.root
        })
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        let proof;
        for (const[i,v] of merkleTree.entries()) {
          if (v[0] == user1.address) {
            proof = merkleTree.getProof(i);
          }
        }
        const amount = NFT_PRICE;
        const quantity = 1;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
            proof
        )).to.be.not.reverted;
      });

      it("Should transfer the funds to the drop owner", async function () {
        const { everDropManager, everNFT, owner, user1, usdc } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address);
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const quantity = 1
        const amount = NFT_PRICE * quantity;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.changeTokenBalances(
            usdc,
            [owner, user1],
            [amount, -amount]
        );
      });

      it("Should not mint an NFT when contract is paused", async function () {
        const { everDropManager, everNFT, owner, user1, usdc } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address)
        await everNFT.pause();
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const quantity = 1
        const amount = NFT_PRICE * quantity;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        expect(await getIneligibilityMintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.equal('MintingPaused');
        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.revertedWith('Pausable: paused');
      });

      it("Should not mint an NFT when amount is correct but allowance is insufficient", async function () {
        const { everDropManager, everNFT, owner, user1, usdc, everErrors } = await loadFixture(deployContracts);
        const updatedPrice = NFT_PRICE * 10;
        await createDrop(everDropManager, everNFT, owner, usdc.address, {
          price: updatedPrice
        })
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const amount = updatedPrice;
        const quantity = 1;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount / 2);

        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.revertedWithCustomError(everErrors, 'IncorrectAmountSent');
      });

      it("Should not mint an NFT when allowance is correct but balance is insufficient", async function () {
        const { everDropManager, everNFT, everErrors, owner, user1, usdc } = await loadFixture(deployContracts);
        const updatedPrice = NFT_PRICE;
        await createDrop(everDropManager, everNFT, owner, usdc.address, {
          price: updatedPrice
        })
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const amount = updatedPrice / 2;
        const quantity = 1;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , updatedPrice);

        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.revertedWithCustomError( everErrors, 'InsufficientBalance');
      });

      it("Should not mint an NFT when sale is not started", async function () {
        const { everDropManager, everNFT, everErrors, owner, user1, usdc } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address, {
          saleOpenTime: Math.floor(new Date('2098-1-1').getTime() / 1000)
        })
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const amount = NFT_PRICE;
        const quantity = 1;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        expect(await getIneligibilityMintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.equal('SaleNotStarted');
        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.revertedWithCustomError(everErrors, 'SaleNotStarted');
      });

      it("Should not mint an NFT when sale is not started and user is not in merkle root", async function () {
        const { everDropManager, everNFT, everErrors, owner, user1, user2, usdc } = await loadFixture(deployContracts);
        const merkleTree = StandardMerkleTree.of(
            [[owner.address], [user2.address]],
            ['address']
        );
        await createDrop(everDropManager, everNFT, owner, usdc.address, {
          saleOpenTime: Math.floor(new Date('2098-1-1').getTime() / 1000),
          merkleRoot: merkleTree.root
        })
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        let proof;
        for (const[i,v] of merkleTree.entries()) {
          if (v[0] == user1.address) {
            proof = merkleTree.getProof(i);
          }
        }
        const amount = NFT_PRICE;
        const quantity = 1;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        expect(await getIneligibilityMintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
            proof
        )).to.be.equal('NotWhiteListed');
        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
            proof
        )).to.be.revertedWithCustomError(everErrors, 'NotWhiteListed');
      });

      it("Should not mint an NFT when sale is not started", async function () {
        const { everDropManager, everNFT, everErrors, owner, user1, usdc } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address, {
          saleOpenTime: Math.floor(new Date('2022-1-1').getTime() / 1000),
          saleCloseTime: Math.floor(new Date('2022-1-9').getTime() / 1000),
        })
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const amount = NFT_PRICE;
        const quantity = 1;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        expect(await getIneligibilityMintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.equal('SaleEnded');
        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.revertedWithCustomError(everErrors, 'SaleEnded');
      });

      it("Should not mint an NFT when drop is sold out", async function () {
        const { everDropManager, everNFT, everErrors, owner, user1, usdc } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address, {
          supply: 1
        })
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const amount = NFT_PRICE;
        const quantity = 1;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        await mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        );

        expect(await getIneligibilityMintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.equal('DropSoldOut');
        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.revertedWithCustomError(everErrors, 'DropSoldOut');
      });

      it("Should not mint an NFT when not enough tokens are available", async function () {
        const { everDropManager, everNFT, everErrors, owner, user1, usdc } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address, {
          supply: 1
        })
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const quantity = 2;
        const amount = NFT_PRICE * quantity;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        expect(await getIneligibilityMintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.equal('NotEnoughTokensAvailable');
        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.be.revertedWithCustomError(everErrors, 'NotEnoughTokensAvailable');
      });
    });

    describe("events", function () {
      it("Should emit transfer events on minting NFT", async function () {
        const { everDropManager, everNFT, owner, user1, usdc } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address);
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const amount = NFT_PRICE;
        const quantity = 1;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            1,
        )).to.emit(everNFT, "Transfer")
            .withArgs(ethers.constants.AddressZero, user1.address, 1);
      });

      it("Should emit NewPrintMinted events on minting NFT", async function () {
        const { everDropManager, everNFT, owner, user1, usdc } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address);
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const amount = NFT_PRICE;
        const quantity = 1;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        )).to.emit(everNFT, "NewPrintMinted").withArgs(dropId, 1, 1);
      });

      it("Should emit multiple events on batch minting NFT", async function () {
        const { everDropManager, everNFT, owner, user1, usdc } = await loadFixture(deployContracts);
        await createDrop(everDropManager, everNFT, owner, usdc.address);
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const quantity = 2;
        const amount = NFT_PRICE * quantity;
        await transferToken(usdc, owner, user1, amount);
        await approveToken(usdc, user1, everNFT.address , amount);

        await expect(mintNFTs(
            everNFT,
            user1,
            dropId,
            quantity,
        ))
            .to.emit(everNFT, "Transfer").withArgs(ethers.constants.AddressZero, user1.address, 1)
            .to.emit(everNFT, "Transfer").withArgs(ethers.constants.AddressZero, user1.address, 2)
            .to.emit(everNFT, "NewPrintMinted").withArgs(dropId, 1, 1)
            .to.emit(everNFT, "NewPrintMinted").withArgs(dropId, 2, 2);
      });
    });
  });
});

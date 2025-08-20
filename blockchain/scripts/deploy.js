const hre = require('hardhat')
require('dotenv').config()

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  console.log('Deploying with', deployer.address)

  const Factory = await hre.ethers.getContractFactory('FoodShareEvents')
  const contract = await Factory.deploy()
  await contract.deployed()
  console.log('Contract deployed at', contract.address)
  console.log('Owner should be deployer:', await contract.owner())
}

main().catch((e) => { console.error(e); process.exit(1) })

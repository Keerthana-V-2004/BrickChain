After running `npx hardhat compile` in the project root, copy the generated
ABIs here:

  artifacts/contracts/RealEstate.sol/RealEstate.json -> frontend/abis/RealEstate.json
  artifacts/contracts/Escrow.sol/Escrow.json         -> frontend/abis/Escrow.json

(On macOS/Linux you can do this with a couple of `cp` commands, or add a
"postcompile" npm script that copies them automatically.)

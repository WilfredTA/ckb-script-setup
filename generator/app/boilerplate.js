import { createRequire } from 'module'
const require = createRequire(import.meta.url)
import fs from 'fs'
import path from 'path'
import * as molecules from '../../shared/schema/blockchain-es.mjs'

const CKB = require('@nervosnetwork/ckb-sdk-core').default



const nodeUrl = 'http://localhost:8114'

const core = new CKB(nodeUrl)

const udtDefPath = "./ckb-miscellaneous-scripts/build/udt_def"
const udtInfoTypePath = "./ckb-miscellaneous-scripts/build/udt_info_type"
const udtInfoLockPath = "./ckb-miscellaneous-scripts/build/udt_info_lock"
let specialCells = {}

// SOME CONVENIENCE METHODS TO USE
// This allows you to ensure that cells used in previous txs are not used in current tx
// when chaining them together
const filterUsedCells = (tx, unspentCells) => {
  let usedCells = {}

  tx.inputs.forEach((i, idx) => {
    let inputId = i.previousOutput.txHash.concat(i.previousOutput.index)
    usedCells[inputId] = true
  })

  return unspentCells.filter((i) => {
    let inputId = i.outPoint.txHash.concat(i.outPoint.index)
    if (usedCells[inputId]) {
      return false
    }


    let specialCellsSerialized =  Object.values(specialCells).map((cell) => {
      return cell.previousOutput.txHash.concat(cell.previousOutput.index)
    })
    if (specialCellsSerialized.includes(inputId)) {
      return false;
    }
    return true
  })
}






const blake2bHashStream = (dataCollection) => {
  if (!Array.isArray(dataCollection)) {
    throw "Input must be array"
  }
  const s = core.utils.blake2b(32, null, null, null);
  dataCollection.forEach((datum) => {
    s.update(core.utils.hexToBytes(datum))
  })
  return `0x${s.digest('hex')}`
}

const serializeDataField = (array) => {
  let newArray = array.map((element) => {
    if (typeof element == "number") {
      let new_el =  `0x${Number(element).toString(16)}`
      console.log(core.utils.hexToBytes(new_el).length, new_el, "<< BYTE LENGTH")
      return new_el
    } else {
      console.log(core.utils.hexToBytes(element).length, element, "<< BYTE LENGTH")
      return element
    }
  })

  return core.utils.serializeStruct(newArray)
}


const init = async () => {

    // Setup parameters needed for tx construction
    const privateKey = "0xd00c06bfd800d27397002dca6fb0993d5ba6399b4238b2f29ee9deb97593d2bc" // example private key taken from dev.toml
    const blockAssemblerCodeHash = "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8" // transcribe the block_assembler.code_hash in the ckb.toml from the ckb project
    const secp256k1Dep = await core.loadSecp256k1Dep() // load the dependencies of secp256k1 algorithm which is used to verify the signature in transaction's witnesses.

    const publicKey = core.utils.privateKeyToPublicKey(privateKey)

    const publicKeyHash = `0x${core.utils.blake160(publicKey, 'hex')}`

    // Default lock script
    const lockScript = {
      hashType: "type",
      codeHash: blockAssemblerCodeHash,
      args: publicKeyHash,
    }

    const lockHash = core.utils.scriptToHash(lockScript)

    const privKey2 = "0x63d86723e08f0f813a36ce6aa123bb2289d90680ae1e99d4de8cdb334553f24d"
    const pubkey2 = core.utils.privateKeyToPublicKey(privKey2)
    const pubkey2Hash = `0x${core.utils.blake160(pubkey2, 'hex')}`

    const lockScript2 = {
      hashType: "type",
      codeHash: blockAssemblerCodeHash,
      args: pubkey2Hash
    }

    const lockHash2 = core.utils.scriptToHash(lockScript2)
    const addresses = {
      mainnetAddress: core.utils.pubkeyToAddress(publicKey, {
        prefix: 'ckb'
      }),
      testnetAddress: core.utils.pubkeyToAddress(publicKey, {
        prefix: 'ckt'
      })
    }


    const signTx = (tx) => {
      return core.signTransaction(privateKey)(tx)
    }

    const getHash = (data) => {
      const s = core.utils.blake2b(32, null, null, core.utils.PERSONAL);
      s.update(core.utils.hexToBytes(data));
      const digest = s.digest('hex');
      return `0x${digest}`;
    }

    const capacityToShannons = (capacity) => {
      if (typeof capacity !== "bigint") {
        capacity = BigInt(capacity)
      }
        return capacity * BigInt((10**8))
    }

    // Does not generate "change" output
    // This is just a convenient method to generate a transaction
    // in which custom outputs and deps can be specified. It is quicker
    // to just build on top of SDK's limited method instead of building from scratch
    // even though this is less efficient
    const generateTransaction = async (outputs, additional = {deps: [], inputs: []}) => {
      const ownerLockScript = lockScript

      const unspentCells = await core.loadCells({lockHash})

      let neededCapacityInBytes = 61 * (outputs.length)
      let newOutputsData = outputs.map((out) => {
        return out.data
      })
      newOutputsData.forEach((datum) => {
        neededCapacityInBytes += core.utils.hexToBytes(datum).length
      })


      let rawTx = await core.generateRawTransaction({
        fromAddress: addresses.testnetAddress,
        toAddress: addresses.testnetAddress,
        capacity: capacityToShannons(neededCapacityInBytes),
        fee: capacityToShannons(1000),
        safeMode: true,
        cells: unspentCells,
        deps: core.config.secp256k1Dep,
      })


      rawTx.cellDeps = rawTx.cellDeps.concat(additional.deps)

      let newOutputs = outputs.map((out) => {
        let result = {lock: out.lock, capacity: out.capacity}
        if (out.type) {
          result.type = out.type
        }
        return result
      })

      rawTx.outputs = newOutputs//.concat([rawTx.outputs[rawTx.outputs.length - 1]])

      rawTx.outputsData = newOutputsData//.concat("0x")
      rawTx.inputs.concat(additional.inputs)
      rawTx.witnesses = rawTx.inputs.map(() => '0x')
      rawTx.witnesses[0] = {
        lock: '',
        inputType: '',
        outputType: ''
      }


      return rawTx

    }

    const getCapacityForFile = (file) => {
      return capacityToShannons(file.byteLength) + 10000000000n
    }

    const convertToDepCell = (txHash, index = "0x0", depType = "code") => {
      return {
        outPoint: {
          txHash,
          index: "0x0"
        },
        depType
      }
    }

    const convertToInputCell = (txHash, index = "0x0", since = "0x0") => {
      return {
        previousOutput: {
          txHash,
          index
        },
        since
      }
    }

    return {
      lockScript,
      lockHash,
      addresses,
      signTx,
      blockAssemblerCodeHash,
      publicKey,
      publicKeyHash,
      secp256k1Dep,
      capacityToShannons,
      getCapacityForFile,
      generateTransaction,
      molecules,
      core,
      getHash,
      convertToDepCell,
      convertToInputCell,
      lockScript2,
      lockHash2
    }



}


const config = async () => {
  return await init()
}

export default config

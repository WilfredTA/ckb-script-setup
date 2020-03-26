import config from './boilerplate.js'
import fs from 'fs'


const issueUdt = async (ckb, udtDefInfo) => {

  // -------------------------------- 1. BUILD YOUR OUTPUTS --------------------------
  // Load in Schema
  let { UDTData, SerializeUDTData } = ckb.molecules

  // Create UDT Data
  let udtAmount = ckb.core.utils.hexToBytes(`0x00000000000000000000000000${Number(250000).toString(16)}`).buffer
  let udtDataObj = {
    amount: udtAmount
  }

  // Serialize UDT Data
  let serializedUdtData = SerializeUDTData(udtDataObj)

  // Verify UDT Data is schema compliant
  let udtData = new UDTData(serializedUdtData)


  // Create Output
  let udtInstanceOutput = {
    capacity: `0x${ckb.capacityToShannons(udtData.view.byteLength)}`,
    lock: ckb.lockScript,
    type: {
      hashType: "data",
      codeHash: udtDefInfo.dataHash,
      args: ckb.core.utils.serializeArray(udtDefInfo.govHash)
    },
    data: `${ckb.core.utils.bytesToHex(new Uint8Array(serializedUdtData))}`
  }

  console.log(udtInstanceOutput)


  //  -------------------------------- 2. GATHER INPUTS & PACKAGE INTO TX --------------------------

  let udtInstanceTx = await ckb.generateTransaction([udtInstanceOutput], {deps: [udtDefInfo.defAsDep]})

  //  -------------------------------- 3. SIGN TRANSACTION --------------------------
  let signedTx = ckb.signTx(udtInstanceTx)


//  -------------------------------- 4. SEND TRANSACTION --------------------------
  let txHash = await ckb.core.rpc.sendTransaction(signedTx)

  return {
    txHash,
    udtInstanceAsInput: ckb.convertToInputCell(txHash),
    udtInstanceTypeHash: ckb.core.utils.scriptToHash(udtInstanceOutput.type),
    defAsDep: udtDefInfo.defAsDep,
    govHash: udtDefInfo.govHash,
    dataHash: udtDefInfo.dataHash
  }
}


const deployCodeCells = async (ckb) => {
  const udtDefCode = fs.readFileSync('../../verifier/ckb-miscellaneous-scripts/build/sudt')

  let udtDefOutput = {
    capacity: `0x${Number(ckb.getCapacityForFile(udtDefCode)).toString(16)}`,
    lock: ckb.lockScript,
    data: ckb.core.utils.bytesToHex(udtDefCode)
  }

  let udtDefTx = await ckb.generateTransaction([udtDefOutput])

  let signedTransaction = ckb.signTx(udtDefTx)

  let txHash = await ckb.core.rpc.sendTransaction(signedTransaction)

  console.log(txHash, "<< UDT Def tx hash")
  return {
    txHash: txHash,
    dataHash: ckb.getHash(ckb.core.utils.bytesToHex(udtDefCode)),
    govHash: ckb.lockHash,
    defAsDep: ckb.convertToDepCell(txHash)
  }
}

const issueUdtWrongGovHash = async (ckb, udtDefInfo) => {
  udtDefInfo.govHash = ckb.lockHash2
  try {
    await issueUdt(ckb, udtDefInfo)
  } catch(e) {
    console.log(e)
    console.log("Should return error -52")
  }
}

const deployTypeIdCode = async (ckb) => {
  const typeIdCode = fs.readFileSync('../../verifier/ckb-miscellaneous-scripts/build/type_id')

  let typeIdOutput = {
    capacity: `0x${Number(ckb.getCapacityForFile(typeIdCode)).toString(16)}`,
    lock: ckb.lockScript,
    data: ckb.core.utils.bytesToHex(typeIdCode)
  }

  let typeIdTx = await ckb.generateTransaction([typeIdOutput])

  let signedTransaction = ckb.signTx(typeIdTx)

  let txHash = await ckb.core.rpc.sendTransaction(signedTransaction)

  console.log(txHash, "<< TypeID tx hash")
  return {
    txHash: txHash,
    dataHash: ckb.getHash(ckb.core.utils.bytesToHex(typeIdCode)),
    govHash: ckb.lockHash,
    typeIdAsDep: ckb.convertToDepCell(txHash)
  }
}

const createCellWithTypeId = async (ckb, typeIdInfo) => {
  let { typeId, SerializetypeId} = ckb.molecules

  let cellWithTypeId = {
    capacity: `0x${ckb.capacityToShannons(10)}`,
    lock: ckb.lockScript,
    type: {
      hashType: "data",
      codeHash: typeIdInfo.dataHash,
      args: "0x"
    },
    data: "0x"
  }

  let typeIdTx = await ckb.generateTransaction([cellWithTypeId], {deps:[typeIdInfo.typeIdAsDep]})

  let input1tx = ckb.core.utils.hexToBytes(typeIdTx.inputs[0].previousOutput.txHash).buffer
  let input1idx = ckb.core.utils.hexToBytes(`0x0000${typeIdTx.inputs[0].previousOutput.index}`).buffer
  let typeIdObj = {
    tx_hash: input1tx,
    idx: input1idx
  }
  let serializedTypeId = SerializetypeId(typeIdObj)
  let typeID = new typeId(serializedTypeId)

  typeIdTx.outputs[0].type.args = ckb.core.utils.bytesToHex(new Uint8Array(serializedTypeId))

  let signedTx = ckb.signTx(typeIdTx)
  let txHash = await ckb.core.rpc.sendTransaction(signedTx)

  return {
    txHash,
    cellWithTypeIdAsInput: ckb.convertToInputCell(txHash),
    cellWithTypeIdTypeHash: ckb.core.utils.scriptToHash(cellWithTypeId.type),
    typeIdAsArg: typeIdTx.outputs[0].type.args,
    typeIdAsDep: typeIdInfo.typeIdAsDep,
    dataHash: typeIdInfo.dataHash
  }

}


const updateCellWithTypeId = async (ckb, typeIdInfo) => {
  let { typeId, SerializetypeId} = ckb.molecules

  let cellWithTypeId = {
    capacity: `0x${ckb.capacityToShannons(10)}`,
    lock: ckb.lockScript,
    type: {
      hashType: "data",
      codeHash: typeIdInfo.dataHash,
      args: "0x"
    },
    data: "0x01"
  }

  let typeIdTx = await ckb.generateTransaction([cellWithTypeId], {deps: [typeIdInfo.typeIdAsDep], inputs: [typeIdInfo.cellWithTypeIdAsInput]})
  typeIdTx.outputs[0].type.args = typeIdInfo.typeIdAsArg
 console.log(typeIdTx.outputs[0].type, "<< UPDATE CELL TX")



  let signedTx = ckb.signTx(typeIdTx)
  let txHash = await ckb.core.rpc.sendTransaction(signedTx)

  return {
    txHash,
    cellWithTypeIdAsInput: ckb.convertToInputCell(txHash),
    cellWithTypeIdTypeHash: ckb.core.utils.scriptToHash(cellWithTypeId.type),
    typeIdAsArg: typeIdTx.outputs[0].type.args
  }

}


const transfer = async (ckb, udtDefInfo, amount, recipient) => {
  let { UDTData, SerializeUDTData } = ckb.molecules

  // Create UDT Data
  let udtAmount = ckb.core.utils.hexToBytes(`0x0000000000000000000000000000${Number(amount).toString(16)}`).buffer
  let udtDataObj = {
    amount: udtAmount
  }

  // Serialize UDT Data
  let serializedUdtData = SerializeUDTData(udtDataObj)

  // Verify UDT Data is schema compliant
  let udtData = new UDTData(serializedUdtData)


  // Create Output
  let udtInstanceOutput = {
    capacity: `0x${ckb.capacityToShannons(udtData.view.byteLength)}`,
    lock: recipient,
    type: {
      hashType: "data",
      codeHash: udtDefInfo.dataHash,
      args: ckb.core.utils.serializeArray(udtDefInfo.govHash)
    },
    data: `${ckb.core.utils.bytesToHex(new Uint8Array(serializedUdtData))}`
  }

  console.log(udtInstanceOutput)


  //  -------------------------------- 2. GATHER INPUTS & PACKAGE INTO TX --------------------------

  let udtInstanceTx = await ckb.generateTransaction([udtInstanceOutput], { deps: [udtDefInfo.defAsDep], inputs: [udtDefInfo.udtInstanceAsInput]})

  //  -------------------------------- 3. SIGN TRANSACTION --------------------------
  let signedTx = ckb.signTx(udtInstanceTx)


//  -------------------------------- 4. SEND TRANSACTION --------------------------
  let txHash = await ckb.core.rpc.sendTransaction(signedTx)

  return {
    txHash,
    udtInstanceAsInput: ckb.convertToInputCell(txHash),
    udtInstanceTypeHash: ckb.core.utils.scriptToHash(udtInstanceOutput.type)
  }
}



const run = async () => {
  try {
    let ckb = await config();
    //await runTypeId(ckb)
    await runUDTDeployment(ckb)
  } catch(e) {
    throw e
  }
}

const runTypeId = async (ckb) => {
  try {
    let typeIdCode = await deployTypeIdCode(ckb)
    let cellWithTypeId = await createCellWithTypeId(ckb, typeIdCode)
    let updatedCellWithTypeId = await updateCellWithTypeId(ckb, cellWithTypeId)
  } catch(e) {
    throw e
  }
}

const runUDTDeployment = async (ckb) => {
  try {
    let udtDefInfo = await deployCodeCells(ckb)
    let udtInstance = await issueUdt(ckb, udtDefInfo)
    let transferRes = await transfer(ckb, udtInstance, 1000, ckb.lockScript2)
  } catch(e) {
    throw e
  }
}

run()

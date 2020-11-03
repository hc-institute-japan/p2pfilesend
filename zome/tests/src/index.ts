import { Orchestrator } from '@holochain/tryorama'
import { Config } from '@holochain/tryorama'

const orchestrator = new Orchestrator()

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const config = Config.gen({
  alice: Config.dna('../p2pfilesend.dna.gz', null),
  bobby: Config.dna('../p2pfilesend.dna.gz', null),
  carly: Config.dna('../p2pfilesend.dna.gz', null)
});

function strToUtf8Bytes(str) {
  const bytes: Array<number> = [];
  // const bytes = new Int8Array();
  for (let ii = 0; ii < str.length; ii++) {
    const code = str.charCodeAt(ii); // x00-xFFFF
    // bytes.push(code & 255, code >> 8); // low, high
    bytes.push(code & 255); // low, high
  }
  return bytes;
}

function utf8_to_str(a) {
  for(var i=0, s=''; i<a.length; i++) {
    var h = a[i].toString(16)
    if(h.length < 2) h = '0' + h
    s += '%' + h
  }
  return decodeURIComponent(s)
}

function send_file(message) {
    return (conductor, caller) =>
      conductor.call(caller, "p2pfilesend", "send_file", message);
};
  
function receive_file() {
  return (conductor, caller) =>
    conductor.call(caller, "p2pfilesend", "receive_file", null);
};

function get_all_file_metadata() {
    return (conductor, caller) =>
      conductor.call(caller, "p2pfilesend", "get_all_file_metadata", null);
};

function get_all_files() {
  return (conductor, caller) =>
    conductor.call(caller, "p2pfilesend", "get_all_files", null);
};

function get_file_from_metadata(metadata) {
    return (conductor, caller) =>
      conductor.call(caller, "p2pfilesend", "get_file_from_metadata", metadata);
  };

function get_all_file_metadata_from_addresses(agent_list) {
    return (conductor, caller) =>
      conductor.call(caller, "p2pfilesend", "get_all_file_metadata_from_addresses", agent_list);
}

function upload_chunk(input) {
  return (conductor, caller) =>
    conductor.call(caller, "p2pfilesend", "upload_chunk", input);
}

function hash_file(input_text) {
  let file_hash = require("crypto")
  .createHash("sha256")
  .update(input_text)
  .digest("hex");
  return file_hash
}

orchestrator.registerScenario("file sending and retrieval", async (s, t) => {
  const { conductor } = await s.players({ conductor: config });
  await conductor.spawn();

  const [dna_hash_1, agent_pubkey_alice] = conductor.cellId('alice');
  const [dna_hash_2, agent_pubkey_bobby] = conductor.cellId('bobby');
  const [dna_hash_3, agent_pubkey_carly] = conductor.cellId('carly');
  console.log("alice address");
  console.log(agent_pubkey_alice);
  console.log("bobby address");
  console.log(agent_pubkey_bobby);
  console.log("carly address");
  console.log(agent_pubkey_carly);

  let text_1 = 'The quick brown fox jumps over the lazy dog.';
  let text_2 = 'Sphinx of black quartz, judge my vow.';
  let text_3 = "A wizard's job is to vex chumps quickly in fog.";
  let file_text_1 = strToUtf8Bytes(text_1);
  let file_text_2 = strToUtf8Bytes(text_2);
  let file_text_3 = strToUtf8Bytes(text_3);
  let message_array = [text_1, text_2, text_3];
  let message_byte_array = [file_text_1, file_text_2, file_text_3];
  let chunk_size = 16;

  /* 
   * ALICE SENDS A FILE TO BOB
   */ 
  let chunks_hashes = new Array();
  for (let i=0; i<file_text_1.length; i=i+chunk_size) {
    let slice = file_text_1.slice(i, i+chunk_size);
    let chunk_hash = await upload_chunk(slice)(conductor, 'alice');
    chunks_hashes.push(chunk_hash)
  }
  const file_hash_1 = hash_file(Int8Array.from(file_text_1));

  const file_meta_1 = {
    receiver: agent_pubkey_bobby,
    file_name: "file_1",
    file_size: file_text_1.length,
    file_type: "text",
    chunks: chunks_hashes,
    hash: file_hash_1
  };

  const send_alice_1 = await send_file(file_meta_1)(conductor, 'alice');
  await delay(1000);
  console.log("alice sends another file to bob");
  console.log(send_alice_1);
  t.deepEqual(send_alice_1.author, agent_pubkey_alice);
  t.deepEqual(send_alice_1.receiver, agent_pubkey_bobby);
  t.deepEqual(send_alice_1.chunks, file_meta_1.chunks);

  /* 
   * ALICE SENDS A SECOND FILE TO BOB
   */
  let chunks_hashes_2 = new Array();  
  for (let i=0; i<file_text_2.length; i=i+chunk_size) {
    let slice = file_text_2.slice(i, i+chunk_size);
    let chunk_hash = await upload_chunk(slice)(conductor, 'alice');
    chunks_hashes_2.push(chunk_hash)
  }
  const file_hash_2 = hash_file(Int8Array.from(file_text_2));

  var file_meta_2: any = {
    receiver: agent_pubkey_bobby,
    file_name: "file_2",
    file_size: file_text_2.length,
    file_type: "text",
    chunks: chunks_hashes_2,
    hash: file_hash_2
  };

  const send_alice_2 = await send_file(file_meta_2)(conductor, 'alice');
  await delay(1000);
  console.log("alice sends another file to bob");
  console.log(send_alice_2);
  t.deepEqual(send_alice_2.author, agent_pubkey_alice);
  t.deepEqual(send_alice_2.receiver, agent_pubkey_bobby);
  t.deepEqual(send_alice_2.chunks, file_meta_2.chunks);

  /* 
   * BOB SENDS A FILE TO ALICE
   */
  let chunks_hashes_3 = new Array();
  for (let i=0; i<file_text_3.length; i=i+chunk_size) {
    let slice = file_text_3.slice(i, i+chunk_size);
    let chunk_hash = await upload_chunk(slice)(conductor, 'alice');
    chunks_hashes_3.push(chunk_hash)
  }
  const file_hash_3 = hash_file(Int8Array.from(file_text_3));

  var file_meta_3: any = {
    receiver: agent_pubkey_alice,
    file_name: "file_3",
    file_size: file_text_3.length,
    file_type: "text",
    chunks: chunks_hashes_3,
    hash: file_hash_3
  };

  const send_bobby_1 = await send_file(file_meta_3)(conductor, 'bobby');
  await delay(1000);
  console.log("bobby sends a file to alice");
  console.log(send_bobby_1);
  t.deepEqual(send_bobby_1.author, agent_pubkey_bobby);
  t.deepEqual(send_bobby_1.receiver, agent_pubkey_alice);
  t.deepEqual(send_bobby_1.chunks, file_meta_3.chunks);

  /* 
   * ALICE GETS ALL FILE METADATA FROM HER SOURCE CHAIN
   */
  const get_all_metadata_alice = await get_all_file_metadata()(conductor, 'alice');
  await delay(1000);
  console.log("alice gets all file metadata");
  console.log(get_all_metadata_alice);
  t.deepEqual(get_all_metadata_alice.length, 3);

  /* 
   * BOBBY GETS A FILE FROM A METADATA
   */
  const get_file_bobby = await get_file_from_metadata(send_alice_1)(conductor, 'bobby');
  await delay(1000);
  console.log("bobby gets the file from a metadata");
  console.log(get_file_bobby);
  t.deepEqual(get_file_bobby, file_text_1);


  /* 
   * ALICE GETS ALL FILES USING THE METADATA IN HER CHAIN
   */
  const alice_get_all_files = await get_all_files()(conductor, 'alice');
  await delay(1000);
  console.log("alice gets all files");
  console.log(alice_get_all_files);
  t.deepEqual(alice_get_all_files.length, message_array.length);
  alice_get_all_files.map(file => {
    let message_string = utf8_to_str(file);
    t.deepEqual(message_array.includes(message_string), true)
  })

  /* 
   * ALICE GETS ALL FILE METADATA AUTHORED BY BOB
   */
  const all_metadata_by_bobby = await get_all_file_metadata_from_addresses([agent_pubkey_bobby])(conductor, 'alice');
  await delay(1000);
  console.log("all file metadata by bobby");
  console.log(all_metadata_by_bobby);
  t.deepEqual(all_metadata_by_bobby[0].metadata.length, 1);

  /* 
   * BOB GETS ALL FILE METADATA AUTHORED BY ALICE
   */
  const all_metadata_by_alice = await get_all_file_metadata_from_addresses([agent_pubkey_alice])(conductor, 'bobby');
  await delay(1000);
  console.log("all file metadata by alice");
  console.log(all_metadata_by_alice);
  t.deepEqual(all_metadata_by_alice[0].metadata.length, 2);

  /* 
   * ALICE GETS ALL FILE METADTA AUTHORED BY ALICE AND BOB
   */
  const all_metadata_by_alice_and_bobby = await get_all_file_metadata_from_addresses([agent_pubkey_alice, agent_pubkey_bobby])(conductor, 'alice');
  await delay(1000);
  console.log("all file metadata by alice and bobby");
  console.log(all_metadata_by_alice_and_bobby);
  t.deepEqual(all_metadata_by_alice_and_bobby[0].metadata.length + all_metadata_by_alice_and_bobby[1].metadata.length, 3);

  /* 
   * ERROR
   * BOBBY SENDS INCOMPLETE CHUNKS
   */
  let chunks_hashes_4 = new Array();
  for (let i=0; i<file_text_3.length; i=i+chunk_size) {
    let slice = file_text_3.slice(i, i+chunk_size);
    if (i == 4) {continue};
    let chunk_hash = await upload_chunk(slice)(conductor, 'alice');
    chunks_hashes_3.push(chunk_hash)
  }
  const file_hash_4 = hash_file(Int8Array.from(file_text_3));

  var file_meta_4: any = {
    receiver: agent_pubkey_alice,
    file_name: "file_3",
    file_size: file_text_3.length,
    file_type: "text",
    chunks: chunks_hashes_4,
    hash: file_hash_4
  };

  const send_bobby_missing = await send_file(file_meta_4)(conductor, 'bobby');
  await delay(1000);
  console.log("bobby sends an incomplete file to alice");

});

orchestrator.run()
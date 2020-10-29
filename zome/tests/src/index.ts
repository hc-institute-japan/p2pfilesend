import { Orchestrator } from '@holochain/tryorama'
import { Config } from '@holochain/tryorama'

const orchestrator = new Orchestrator()

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const config = Config.gen({
  alice: Config.dna('../p2pfilesend.dna.gz', null),
  bobby: Config.dna('../p2pfilesend.dna.gz', null),
  carly: Config.dna('../p2pfilesend.dna.gz', null)
});


function strToUtf16Bytes(str) {
  const bytes: Array<number> = [];
  for (let ii = 0; ii < str.length; ii++) {
    const code = str.charCodeAt(ii); // x00-xFFFF
    bytes.push(code & 255, code >> 8); // low, high
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

function send_file_2(metadata) {
  return (conductor, caller) =>
    conductor.call(caller, "p2pfilesend", "send_file_2", metadata);
};

orchestrator.registerScenario("file sending", async (s, t) => {
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

  let text_1 = "The quick brown fox jumps over the lazy dog.";
  let text_2 = "Sphinx of black quartz, judge my vow.";
  let text_3 = "A wizard's job is to vex chumps quickly in fog.";
  let file_text_1 = strToUtf16Bytes(text_1);
  let file_text_2 = strToUtf16Bytes(text_2);
  let file_text_3 = strToUtf16Bytes(text_3);

  /* 
   * ALICE SENDS A FILE TO BOB
   */ 
  let chunk_size = 10;
  let chunks_hashes = new Array();  
  for (let i=0; i<file_text_1.length; i=i+chunk_size) {
    let slice = file_text_1.slice(i, i+chunk_size);
    let chunk_hash = await upload_chunk(slice)(conductor, 'alice');
    chunks_hashes.push(chunk_hash)
  }

  const file_meta_1 = {
    receiver: agent_pubkey_bobby,
    file_name: "file_1",
    file_size: file_text_1.length,
    file_type: "text",
    chunks: chunks_hashes
  };

  const send_alice = await send_file_2(file_meta_1)(conductor, 'alice');
  await delay(1000);
  console.log("alice sends another file to bob");
  console.log(send_alice);
  t.deepEqual(send_alice.author, agent_pubkey_alice);
  t.deepEqual(send_alice.receiver, agent_pubkey_bobby);

  /* 
   * ALICE SENDS A SECOND FILE TO BOB
   */
  let chunks_hashes_2 = new Array();  
  for (let i=0; i<file_text_2.length; i=i+chunk_size) {
    let slice = file_text_2.slice(i, i+chunk_size);
    let chunk_hash = await upload_chunk(slice)(conductor, 'alice');
    chunks_hashes_2.push(chunk_hash)
  }

  const file_meta_2 = {
    receiver: agent_pubkey_bobby,
    file_name: "file_2",
    file_size: file_text_2.length,
    file_type: "text",
    chunks: chunks_hashes_2
  };

  const send_alice_2 = await send_file_2(file_meta_2)(conductor, 'alice');
  await delay(1000);
  console.log("alice sends another file to bob");
  console.log(send_alice_2);
  t.deepEqual(send_alice_2.author, agent_pubkey_alice);
  t.deepEqual(send_alice_2.receiver, agent_pubkey_bobby);

  /* 
   * BOB SENDS A FILE TO ALICE
   */
  let chunks_hashes_3 = new Array();  
  for (let i=0; i<file_text_3.length; i=i+chunk_size) {
    let slice = file_text_3.slice(i, i+chunk_size);
    let chunk_hash = await upload_chunk(slice)(conductor, 'alice');
    chunks_hashes_3.push(chunk_hash)
  }

  const file_meta_3 = {
    receiver: agent_pubkey_alice,
    file_name: "file_3",
    file_size: file_text_3.length,
    file_type: "text",
    chunks: chunks_hashes_3
  };

  const send_bobby_1 = await send_file_2(file_meta_3)(conductor, 'bobby');
  await delay(1000);
  console.log("bobby sends a file to alice");
  console.log(send_bobby_1);
  t.deepEqual(send_bobby_1.author, agent_pubkey_bobby);
  t.deepEqual(send_bobby_1.receiver, agent_pubkey_alice);

  // alice gets all file metadata
  const get_all_metadata_alice = await get_all_file_metadata()(conductor, 'alice');
  await delay(1000);
  console.log("alice gets all file metadata");
  console.log(get_all_metadata_alice);

  // alice gets the file from a metadata
  const get_file_alice = await get_file_from_metadata(get_all_metadata_alice[0])(conductor, 'alice');
  await delay(1000);
  console.log("alice gets the file from a metadata");
  console.log(get_file_alice);
  console.log(utf8_to_str(get_file_alice));

  // alice gets all files
  const alice_get_all_files = await get_all_files()(conductor, 'alice');
  await delay(1000);
  console.log("alice gets all files");
  console.log(alice_get_all_files);

  alice_get_all_files.map(file_utf => console.log(utf8_to_str(file_utf)));

  // alice gets all file metadata authored by bob
  const all_metadata_by_bobby = await get_all_file_metadata_from_addresses([agent_pubkey_bobby])(conductor, 'alice');
  await delay(1000);
  console.log("all file metadata by bobby");
  console.log(all_metadata_by_bobby);
  console.log(all_metadata_by_bobby[0].metadata.length);

  // bobby gets all file metadata authored by alice
  const all_metadata_by_alice = await get_all_file_metadata_from_addresses([agent_pubkey_alice])(conductor, 'bobby');
  await delay(1000);
  console.log("all file metadata by alice");
  console.log(all_metadata_by_alice);
  console.log(all_metadata_by_alice[0].metadata.length);

  // alice gets all file metadata authored by alice and bob
  const all_metadata_by_alice_and_bobby = await get_all_file_metadata_from_addresses([agent_pubkey_alice, agent_pubkey_bobby])(conductor, 'alice');
  await delay(1000);
  console.log("all file metadata by alice and bobby");
  console.log(all_metadata_by_alice_and_bobby);
  console.log(all_metadata_by_alice_and_bobby[0].metadata.length);
});

orchestrator.run()
import { Orchestrator } from '@holochain/tryorama'
import { Config } from '@holochain/tryorama'

const orchestrator = new Orchestrator()

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const config = Config.gen({
  alice: Config.dna('../p2pfilesend.dna.gz', null),
  bobby: Config.dna('../p2pfilesend.dna.gz', null),
  carly: Config.dna('../p2pfilesend.dna.gz', null)
})

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

orchestrator.registerScenario("remote call", async (s, t) => {
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
  let file_text_1 =  strToUtf16Bytes(text_1);
  let file_text_2 =  strToUtf16Bytes(text_2);

  const file_1 = {
      receiver: agent_pubkey_bobby,
      file_name: "file_1",
      file_size: file_text_1.length,
      file_type: "text",
      bytes: file_text_1
  };

  const file_2 = {
      receiver: agent_pubkey_bobby,
      file_name: "file_2",
      file_size: file_text_2.length,
      file_type: "text",
      bytes: file_text_2
  };

  // alice sends a file to bob
  const send_alice = await send_file(file_1)(conductor, 'alice');
  await delay(1000);
  console.log("alice sends file to bob");
  console.log(send_alice);
  t.deepEqual(send_alice.author, agent_pubkey_alice);
  t.deepEqual(send_alice.receiver, agent_pubkey_bobby);

  // alice sends a second file to bob
  const send_alice_2 = await send_file(file_2)(conductor, 'alice');
  await delay(1000);
  console.log("alice sends another file to bob");
  console.log(send_alice_2);
  t.deepEqual(send_alice_2.author, agent_pubkey_alice);
  t.deepEqual(send_alice_2.receiver, agent_pubkey_bobby);

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
  t.deepEqual(get_file_alice, file_text_2);

  // alice gets all files
  const alice_get_all_files = await get_all_files()(conductor, 'alice');
  await delay(1000);
  console.log("alice gets all files");
  console.log(alice_get_all_files);

  alice_get_all_files.map(file_utf => console.log(utf8_to_str(file_utf)));

});

  orchestrator.run()
use hdk3::prelude::*;
use crate::{timestamp::Timestamp};
use crate::utils::{
    try_get_and_convert,
    try_from_element,
    address_deduper
};

use hex_literal::hex;
use sha2::{Sha256, Digest};
extern crate byte_string;

use byte_string::ByteStr;

use super::{
    FileMetadataEntry,
    FileMetadataOutput,
    FileMetadataOption,
    FileInput,
    FileChunk,
    FileOutput,
    FileOutputList,
    FileMetadataList,
    FileMetadataByAgentListWrapper,
    FileMetadataByAgent,
    AgentListWrapper
};

pub(crate) fn upload_chunk(file_chunk_input: FileChunk) -> ExternResult<EntryHash> {
    let file_chunk = FileChunk(file_chunk_input.0);
    let file_chunk_hash = hash_entry!(file_chunk.clone())?;
    let _chunk_address = create_entry!(&file_chunk)?;
    Ok(file_chunk_hash)
}

pub fn get_file_chunk(file_chunk_hash: EntryHash) -> ExternResult<FileChunk> {
    try_get_and_convert::<FileChunk>(file_chunk_hash)
        .map(|file_chunk_with_address| (file_chunk_with_address.1))
}

pub fn get_bytes_from_chunks(chunks_hashes: Vec<EntryHash>) -> ExternResult<Vec<u8>> {
    let byte_chunks = chunks_hashes
        .into_iter()
        .map(|chunk_hash| get_file_chunk(chunk_hash).map(|chunk| chunk.0))
        .collect::<ExternResult<Vec<Vec<u8>>>>()?;

    Ok(byte_chunks
        .into_iter()
        .fold(vec![], |mut acc, mut byte_chunk| {
            acc.append(&mut byte_chunk);
            acc
        }))
}


#[hdk_extern]
fn init(_: ()) -> ExternResult<InitCallbackResult> {
    let mut functions: GrantedFunctions = HashSet::new();
    functions.insert((zome_info!()?.zome_name, "receive_file".into()));
    create_cap_grant!(
        CapGrantEntry {
            tag: "receive_file".into(),
            access: ().into(),
            functions,
        }
    )?;

    Ok(InitCallbackResult::Pass)
}

pub(crate) fn send_file(file_input: FileInput) -> ExternResult<FileMetadataOption> {

    let bytes = get_bytes_from_chunks(file_input.chunks.clone())?;

    let mut hasher = Sha256::new();
    hasher.update(bytes.clone().to_string());
    let dht_file_hash = hasher.finalize();
    
    // debug!(format!("nicko send bytes: {:?}", bytes.clone()))?;
    // debug!(format!("nicko send dht hash: {:?}", dht_file_hash.clone()))?;
    // debug!(format!("nicko send ui hash: {:?}", hex::decode(file_input.hash.clone()).unwrap()))?;

    // compare hashes
    if dht_file_hash.as_slice().to_vec() == hex::decode(file_input.hash.clone()).unwrap() {
        let now = sys_time!()?;
        let file_metadata = FileMetadataOutput {
            author: agent_info!()?.agent_latest_pubkey,
            receiver: file_input.receiver.clone(),
            file_name: file_input.file_name,
            file_size: file_input.file_size,
            file_type: file_input.file_type,
            time_sent: Timestamp(now.as_secs() as i64, now.subsec_nanos()),
            time_received: None,
            chunks: file_input.chunks
        };
        let payload: SerializedBytes = file_metadata.try_into()?;

        match call_remote!(
            file_input.receiver,
            zome_info!()?.zome_name,
            "receive_file".into(),
            None,
            payload
        )? {
            ZomeCallResponse::Ok(output) => {
                debug!(format!("nicko call remote success"))?;
                let file_output: FileMetadataOption = output.into_inner().try_into()?;
                match file_output.0 {
                    Some(file_output) => {
                        let file_metadata_entry = FileMetadataEntry::from_output(file_output.clone());
                        create_entry!(&file_metadata_entry)?;
                        Ok(FileMetadataOption(Some(file_output)))
                    },
                    None => {
                        Ok(FileMetadataOption(None))
                    }
                }
            },
            ZomeCallResponse::Unauthorized => {
                crate::error("{\"code\": \"401\", \"message\": \"This agent has no proper authorization\"}")
            }
        }
    } else {
        // hashes are not equal
        crate::error("{\"code\": \"401\", \"message\": \"File integrity check failed. UI file hash and DHT file hash are not equal. Problem uploading file. Please retry.\"}")
    }
}


pub(crate) fn receive_file(metadata_input: FileMetadataOutput) -> ExternResult<FileMetadataOption> {
    debug!(format!("nicko call remote success callee entered"))?;
    let mut file_metadata = FileMetadataEntry::from_output(metadata_input.clone());
    let now = sys_time!()?;
    file_metadata.time_received = Some(Timestamp(now.as_secs() as i64, now.subsec_nanos()));

    match create_entry!(&file_metadata) {
        Ok(_header) => {
            let file_output = FileMetadataOutput::from_entry(file_metadata);
            Ok(FileMetadataOption(Some(file_output)))
        },
        _ => {
            Ok(FileMetadataOption(None))
        }
    }
}

pub(crate) fn get_all_file_metadata(_: ()) -> ExternResult<FileMetadataList> {
    let query_result = query!(
        QueryFilter::new()
        .entry_type(
            EntryType::App(
                AppEntryType::new(
                    EntryDefIndex::from(0),
                    zome_info!()?.zome_id,
                    EntryVisibility::Public
                )
            )
        )
        .include_entries(true)
    )?;

    let file_metadata_vec: Vec<FileMetadataOutput> = query_result.0
        .into_iter()
        .filter_map(|el| {
            let entry = try_from_element(el);
            match entry {
                Ok(file_metadata_entry) => Some(file_metadata_entry),
                _ => None
            }
        }).collect();
    
        Ok(FileMetadataList(file_metadata_vec))
}

pub(crate) fn get_file_from_metadata(file_metadata: FileMetadataOutput) -> ExternResult<FileOutput> {
    let chunks_hashes = file_metadata.chunks;
    let return_val = get_bytes_from_chunks(chunks_hashes)?;
    Ok(FileOutput(return_val))
}

pub(crate) fn get_all_files(_: ()) -> ExternResult<FileOutputList> {
    let metadata_list = get_all_file_metadata(())?;

    let file_output_list: Vec<FileOutput> = metadata_list.0
        .into_iter()
        .filter_map(|metadata| {
            let file = get_file_from_metadata(metadata);
            match file {
                Ok(file) => Some(file),
                _ => None
            }
        })
        .collect();

    Ok(FileOutputList(file_output_list))
}

pub(crate) fn get_all_file_metadata_from_addresses(agent_list: AgentListWrapper) -> ExternResult<FileMetadataByAgentListWrapper> {
    let deduped_agents = address_deduper(agent_list.0);
    
    let query_result = query!(
        QueryFilter::new()
        .entry_type(
            EntryType::App(
                AppEntryType::new(
                    EntryDefIndex::from(0),
                    zome_info!()?.zome_id,
                    EntryVisibility::Public
                )
            )
        )
        .include_entries(true)
    )?;

    let mut agent_filemetadata_hashmap = std::collections::HashMap::new();
    for agent in deduped_agents {
        let file_metadata_list: Vec<FileMetadataOutput> = Vec::new();
        agent_filemetadata_hashmap.insert(agent, file_metadata_list);                                                                                                                                                                               
    };

    let _map_result: Vec<FileMetadataOutput> = query_result.0
        .into_iter()
        .filter_map(|el| {
            let entry = try_from_element::<FileMetadataEntry>(el);
            match entry {
                Ok(file_metadata_entry) => {
                    let file_metadata_output = FileMetadataOutput::from_entry(file_metadata_entry);
                    if agent_filemetadata_hashmap.contains_key(&file_metadata_output.author) {
                        if let Some(vec) = agent_filemetadata_hashmap.get_mut(&file_metadata_output.author) {
                            &vec.push(file_metadata_output.clone());
                        };
                    }
                    Some(file_metadata_output)
                },
                _ => {
                    debug!(format!("nicko iter error")).ok()?;
                    None
                }
            }
        })
        .collect();

    let mut agent_filemetadata_vec: Vec<FileMetadataByAgent> = Vec::new();
    for (agent, list) in agent_filemetadata_hashmap.iter() {
        agent_filemetadata_vec.push(
            FileMetadataByAgent {
                author: agent.to_owned(),
                metadata: (*list).to_vec()
            }
        );
    };

    Ok(FileMetadataByAgentListWrapper(agent_filemetadata_vec))
}
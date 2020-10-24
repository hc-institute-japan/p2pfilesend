use hdk3::prelude::*;
use crate::{timestamp::Timestamp};
use crate::utils::{
    try_get_and_convert,
    try_from_element
};

use super::{
    FileMetadataEntry,
    FileMetadataOutput,
    FileMetadataOption,
    FileInput,
    FileChunk,
    FileOutput,
    FileOutputList,
    FileMetadataList
};

// const CHUNK_SIZE: usize = 256 * 1024;
const CHUNK_SIZE: usize = 2;

pub fn create_file_chunk(bytes: Vec<u8>) -> ExternResult<EntryHash> {
    let file_chunk = FileChunk(bytes);
    let file_chunk_hash = hash_entry!(file_chunk.clone())?;
    let chunk_address = create_entry!(&file_chunk)?;
    Ok(file_chunk_hash)
}

pub fn create_chunks_from_bytes(bytes: Vec<u8>) -> ExternResult<Vec<EntryHash>> {
    let chunks: Vec<Vec<u8>> = bytes
        .chunks(CHUNK_SIZE)
        .map(|bytes| Vec::from(bytes))
        .collect();

    chunks
        .into_iter()
        .map(|chunk_bytes| create_file_chunk(chunk_bytes))
        .collect()
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

pub fn get_file_chunk(file_chunk_hash: EntryHash) -> ExternResult<FileChunk> {
    try_get_and_convert::<FileChunk>(file_chunk_hash)
        .map(|file_chunk_with_address| (file_chunk_with_address.1))
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

    let chunks_hashes = create_chunks_from_bytes(file_input.bytes)?;

    let now = sys_time!()?;
    let file_metadata = FileMetadataOutput {
        author: agent_info!()?.agent_latest_pubkey,
        receiver: file_input.receiver.clone(),
        file_name: file_input.file_name,
        file_size: file_input.file_size,
        file_type: file_input.file_type,
        time_sent: Timestamp(now.as_secs() as i64, now.subsec_nanos()),
        time_received: None,
        chunks: chunks_hashes
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
}

pub(crate) fn receive_file(metadata_input: FileMetadataOutput) -> ExternResult<FileMetadataOption> {
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
    
    let byte_chunks = chunks_hashes
        .into_iter()
        .map(|chunk_hash| {
            get_file_chunk(chunk_hash)
            .map(|chunk| chunk.0)
        })
        .collect::<ExternResult<Vec<Vec<u8>>>>()?;

    let return_val = byte_chunks
        .into_iter()
        .fold(vec![], |mut acc, mut byte_chunk| {
            acc.append(&mut byte_chunk);
            acc
        });
    
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


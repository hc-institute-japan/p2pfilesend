use hdk3::prelude::*;
mod entries;
mod utils;
use entries::file;

use file::{
    FileMetadataEntry,
    FileMetadataOutput,
    FileMetadataOption,
    FileInput,
    FileChunk,
    FileOutput,
    FileOutputList,
    FileMetadataList
};

pub fn error<T>(reason: &str) -> ExternResult<T> {
    Err(HdkError::Wasm(WasmError::Zome(String::from(reason))))
}

entry_defs![
    FileMetadataEntry::entry_def(),
    FileChunk::entry_def()
];

#[hdk_extern]
pub fn send_file(file_input: FileInput) -> ExternResult<FileMetadataOption> {
    file::handlers::send_file(file_input)
}

#[hdk_extern]
pub fn receive_file(metadata_input: FileMetadataOutput) -> ExternResult<FileMetadataOption> {
    file::handlers::receive_file(metadata_input)
}

#[hdk_extern]
pub fn get_all_file_metadata(_: ()) -> ExternResult<FileMetadataList> {
    file::handlers::get_all_file_metadata(())
}

#[hdk_extern]
pub fn get_file_from_metadata(file_metadata: FileMetadataOutput) -> ExternResult<FileOutput> {
    file::handlers::get_file_from_metadata(file_metadata)
}

#[hdk_extern]
pub(crate) fn get_all_files(_: ()) -> ExternResult<FileOutputList> {
    file::handlers::get_all_files(())
}

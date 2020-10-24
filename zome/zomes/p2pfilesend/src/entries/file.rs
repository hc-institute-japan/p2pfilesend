use hdk3::prelude::*;
use derive_more::{From, Into};
use crate::{timestamp::Timestamp};
pub mod handlers;

#[hdk_entry(id="file_metadata", visibility="public")]
#[derive(Clone, Debug)]
pub struct FileMetadataEntry {
   author: AgentPubKey,
   receiver: AgentPubKey,
   file_name: String,
   file_size: usize,
   file_type: String,
   time_sent: Timestamp,
   time_received: Option<Timestamp>,
   chunks: Vec<EntryHash>
}

// chunks done by UI for the meantime
#[hdk_entry(id = "file_chunk", visibility = "public")]
#[derive(Clone)]
pub struct FileChunk(Vec<u8>);

#[derive(From, Into, Serialize, Deserialize, SerializedBytes, Clone, Debug)]
pub struct FileInput {
    pub receiver: AgentPubKey,
    pub file_name: String,
    pub file_size: usize,
    pub file_type: String,
    pub bytes: Vec<u8>,
}

#[derive(From, Into, Serialize, Deserialize, SerializedBytes, Clone, Debug)]
pub struct FileMetadataOutput {
    author: AgentPubKey,
    receiver: AgentPubKey,
    file_name: String,
    file_size: usize,
    file_type: String,
    time_sent: Timestamp,
    time_received: Option<Timestamp>,
    chunks: Vec<EntryHash>
 }

#[derive(From, Into, Serialize, Deserialize, SerializedBytes)]
pub struct FileMetadataOption(Option<FileMetadataOutput>);

impl FileMetadataEntry {
    pub fn from_output(file_metadata_output: FileMetadataOutput) -> Self {
        FileMetadataEntry {
            author: file_metadata_output.author,
            receiver: file_metadata_output.receiver,
            file_name: file_metadata_output.file_name,
            file_size: file_metadata_output.file_size,
            file_type: file_metadata_output.file_type,
            time_sent: file_metadata_output.time_sent,
            time_received: file_metadata_output.time_received,
            chunks: file_metadata_output.chunks
        }
    }
}

impl FileMetadataOutput {
    pub fn from_entry(file_metadata_entry: FileMetadataEntry) -> Self {
        FileMetadataOutput {
            author: file_metadata_entry.author,
            receiver: file_metadata_entry.receiver,
            file_name: file_metadata_entry.file_name,
            file_size: file_metadata_entry.file_size,
            file_type: file_metadata_entry.file_type, 
            time_sent: file_metadata_entry.time_sent,
            time_received: file_metadata_entry.time_received,
            chunks: file_metadata_entry.chunks
        }
    }
}

#[derive(From, Into, Serialize, Deserialize, SerializedBytes)]
pub struct FileMetadataList(Vec<FileMetadataOutput>);

#[derive(From, Into, Serialize, Deserialize, SerializedBytes)]
pub struct FileOutput(Vec<u8>);

#[derive(From, Into, Serialize, Deserialize, SerializedBytes)]
pub struct FileOutputList(Vec<FileOutput>);
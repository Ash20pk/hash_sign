import React, { useState, useEffect } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { aptosClient } from "@/utils/aptosClient";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import axios from 'axios';
import { Modal, Button, Upload, message, Input } from 'antd';
import { UploadOutlined, PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import { WalletSelector } from "./WalletSelector";

interface Signature {
  signer: string;
  timestamp: string;
}

interface Document {
  id: number;
  content_hash: string;
  creator: string;
  signers: string[];
  signatures: Signature[];
  is_completed: boolean;
}

interface DocumentStore {
  documents: Document[];
  document_counter: number;
}

const HashSignDApp: React.FC = () => {
  const { account, signAndSubmitTransaction } = useWallet();
  const [isRegistered, setIsRegistered] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [signers, setSigners] = useState("");
  const [transactionInProgress, setTransactionInProgress] = useState(false);
  const [viewDocumentUrl, setViewDocumentUrl] = useState<string | null>(null);
  const moduleAddress = process.env.VITE_APP_MODULE_ADDRESS;

  useEffect(() => {
    if (account) {
      checkRegistration();
      fetchDocuments();
    }
  }, [account]);

  const checkRegistration = async () => {
    if (!account) return;
    try {
      await aptosClient().getAccountResource({
        accountAddress: account.address,
        resourceType: `${moduleAddress}::hash_sign1::DocumentStore`
      });
      setIsRegistered(true);
    } catch (error) {
      setIsRegistered(false);
    }
  };

  const register = async () => {
    if (!account) return;
    setTransactionInProgress(true);
    try {
      const payload: InputTransactionData = {
        data: {
          function: `${moduleAddress}::hash_sign1::initialize`,
          functionArguments: [],
        }
      };
      await signAndSubmitTransaction(payload);
      setIsRegistered(true);
    } catch (error) {
      console.error("Error registering:", error);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const fetchDocuments = async () => {
    if (!account) return;
    try {
      const resource = await aptosClient().getAccountResource({
        accountAddress: account.address,
        resourceType: `${moduleAddress}::hash_sign1::DocumentStore`
      });
      const documentStore = resource as DocumentStore;
      const userDocuments = documentStore.documents.filter(
        doc => doc.creator === account.address
      );
      setDocuments(userDocuments);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  const uploadToPinata = async (file: File) => {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

    // Create form data
    let formData = new FormData();
    formData.append('file', file);
    const metadata = JSON.stringify({
        name: 'Property Image',
    });
    formData.append('pinataMetadata', metadata);
    const options = JSON.stringify({
        cidVersion: 0,
    })
    formData.append('pinataOptions', options);

    try {
        const res = await axios.post(url, formData, {
            method: "post",
            data: formData,
            headers: {
                'pinata_api_key': process.env.VITE_APP_PINATA_API_KEY,
                'pinata_secret_api_key': process.env.VITE_APP_PINATA_SECRET_API_KEY,
                "Content-Type": "multipart/form-data"
            },
            });
      return res.data.IpfsHash;
    } catch (error) {
      console.error("Error uploading to Pinata:", error);
      throw error;
    }
  };

  const handleCreateDocument = async () => {
    if (!account || !file || !signers) return;
    setTransactionInProgress(true);
    try {
      const cid = await uploadToPinata(file);
      const signerAddresses = signers.split(',').map(addr => addr.trim());
      const payload: InputTransactionData = {
        data: {
          function: `${moduleAddress}::hash_sign1::create_document`,
          functionArguments: [cid, signerAddresses],
        }
      };
      await signAndSubmitTransaction(payload);
      setIsModalVisible(false);
      setFile(null);
      setSigners("");
      fetchDocuments();
    } catch (error) {
      console.error("Error creating document:", error);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleSignDocument = async (documentId: number) => {
    if (!account) return;
    setTransactionInProgress(true);
    try {
      const payload: InputTransactionData = {
        data: {
          function: `${moduleAddress}::hash_sign1::sign_document`,
          functionArguments: [documentId],
        }
      };
      await signAndSubmitTransaction(payload);
      fetchDocuments();
    } catch (error) {
      console.error("Error signing document:", error);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleViewDocument = async (cid: string) => {
    try {
      const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
      const response = await axios.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const objectUrl = URL.createObjectURL(blob);
      setViewDocumentUrl(objectUrl);
    } catch (error) {
      console.error("Error fetching document:", error);
      message.error("Failed to fetch the document. Please try again.");
    }
  };
  const renderDocumentPreview = (doc: Document) => {
    const fileExtension = doc.content_hash.split('.').pop()?.toLowerCase();
    if (fileExtension === 'pdf') {
      return <FileTextOutlined style={{ fontSize: '48px', color: '#e74c3c' }} />;
    } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension || '')) {
      return <img src={`https://gateway.pinata.cloud/ipfs/${doc.content_hash}`} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover' }} />;
    } else {
      return <FileTextOutlined style={{ fontSize: '48px', color: '#3498db' }} />;
    }
  };

  if (!account) {
    return (
      <div className="container mx-auto px-4 py-8">
        <WalletSelector />
        <h2 className="text-2xl font-bold mb-4">Please connect your wallet to use HashSign</h2>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Welcome to HashSign</h2>
          <p className="mb-4">To get started, please register your account.</p>
          <Button
            onClick={register}
            disabled={transactionInProgress}
            type="primary"
            size="large"
          >
            Register
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">HashSign Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Button
          onClick={() => setIsModalVisible(true)}
          type="primary"
          icon={<PlusOutlined />}
          size="large"
        >
          Create Document
        </Button>
        <WalletSelector />
        </div>

      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Your Documents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-center mb-4">
                {renderDocumentPreview(doc)}
              </div>
              <p className="mb-2">Status: {doc.is_completed ? 'Completed' : 'Pending'}</p>
              <p className="mb-4">Signatures: {doc.signatures.length}/{doc.signers.length}</p>
              <Button onClick={() => handleViewDocument(doc.content_hash)} type="primary" block>
                View Document
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Modal
        title="Create New Document"
        open={isModalVisible}
        onOk={handleCreateDocument}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={transactionInProgress}
      >
        <Upload
          beforeUpload={(file) => {
            const isLt25M = file.size / 1024 / 1024 < 25;
            if (!isLt25M) {
              message.error('File must be smaller than 25MB!');
            } else {
              setFile(file);
            }
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>Select File (Max: 25MB)</Button>
        </Upload>
        <Input
          placeholder="Enter signer addresses (comma-separated)"
          value={signers}
          onChange={(e) => setSigners(e.target.value)}
          className="mt-4"
        />
      </Modal>

      <Modal
        title="View Document"
        open={!!viewDocumentUrl}
        onCancel={() => setViewDocumentUrl(null)}
        footer={null}
        width={800}
      >
        {viewDocumentUrl && (
          <iframe
            src={viewDocumentUrl}
            style={{ width: '100%', height: '70vh', border: 'none' }}
            title="Document Viewer"
          />
        )}
      </Modal>
    </div>
  );
};

export default HashSignDApp;

import React from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { WalletSelector } from "./components/WalletSelector";
import ContractManagement from "@/components/ContractManagement";

function App() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen flex flex-col">      
      <main className="flex-grow">
        {connected ? (
          <ContractManagement />
        ) : (
          <div className="flex items-center justify-center h-full">
            <CardHeader>
              <CardTitle>To get started Connect a wallet</CardTitle>
              <WalletSelector />
            </CardHeader>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
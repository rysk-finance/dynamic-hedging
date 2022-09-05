import React from "react";
import { VaultContent } from "../components/vault/VaultContent";
import { VaultStateManagment } from "../components/vault/VaultStateManagement";
import { VaultProvider } from "../state/VaultContext";

export const Vault = () => {
  return (
    <VaultProvider>
      <VaultStateManagment />
      <VaultContent />
    </VaultProvider>
  );
};

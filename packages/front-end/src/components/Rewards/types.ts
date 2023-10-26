export interface RewardsQuery {
  airdropRecipients: {
    id: HexString;
    totalTokens: string;
    totalValue: string;
  }[];
}

export type UseAirdropDataValues = [
  RewardsQuery["airdropRecipients"],
  number,
  number,
];

export interface RecipientsProps {
  recipients: RewardsQuery["airdropRecipients"];
  tokens: number;
  value: number;
}

export interface TableProps {
  recipients: RewardsQuery["airdropRecipients"];
}
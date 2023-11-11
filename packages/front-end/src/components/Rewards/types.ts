export interface AirdropRecipient {
  id: HexString;
  totalTokens: string;
  totalValue: string;
}

export interface RewardsQuery {
  airdropRecipients: AirdropRecipient[];
  airdropStat: {
    totalArb: string;
    totalRecipients: string;
    totalValue: string;
  } | null;
  user: AirdropRecipient | null;
}

export type UseAirdropDataValues = [
  RewardsQuery["airdropRecipients"],
  number,
  number,
  number,
];

export interface RecipientsProps {
  recipients: number;
  tokens: number;
  value: number;
}

export interface TableProps {
  recipients: RewardsQuery["airdropRecipients"];
}

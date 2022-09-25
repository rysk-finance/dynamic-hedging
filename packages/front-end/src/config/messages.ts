import { DHV_NAME } from "./constants";

export const DEPOSIT_SHARES_EPOCH = `Your deposit will be deployed to the vault on Friday at 11am UTC.
                                     You can start earning returns and initiate a withdraw from this time onwards.`;

export const WITHDRAW_SHARES_EPOCH = `Your withdraw on hold will be converted to USDC on Friday at 11am UTC.
                                      You can then complete your withdraw to get your USDC.`;

// export const WITHDRAW_ESTIMATE_MESSAGE = `This is the current value of your withdraw. Your withdraw will be made from the vault on Friday at 11am UTC. At this time the value of your withdraw could be higher or lower than this estimate.`;
export const WITHDRAW_ESTIMATE_MESSAGE = `Values above are estimates based on the current position of the vault. Your withdraw will be made on Friday at 11am UTC. At this time the position of the vault could be different, meaning the amount you recieve could differ from the value shown.`;
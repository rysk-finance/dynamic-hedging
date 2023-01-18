/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { Manager, ManagerInterface } from "../Manager";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_authority",
        type: "address",
      },
      {
        internalType: "address",
        name: "_liquidityPool",
        type: "address",
      },
      {
        internalType: "address",
        name: "_optionHandler",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "ExceedsDeltaLimit",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidAddress",
    type: "error",
  },
  {
    inputs: [],
    name: "NotKeeper",
    type: "error",
  },
  {
    inputs: [],
    name: "NotProxyManager",
    type: "error",
  },
  {
    inputs: [],
    name: "PRBMathSD59x18__AbsInputTooSmall",
    type: "error",
  },
  {
    inputs: [],
    name: "UNAUTHORIZED",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "contract IAuthority",
        name: "authority",
        type: "address",
      },
    ],
    name: "AuthorityUpdated",
    type: "event",
  },
  {
    inputs: [],
    name: "authority",
    outputs: [
      {
        internalType: "contract IAuthority",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "uint64",
            name: "expiration",
            type: "uint64",
          },
          {
            internalType: "uint128",
            name: "strike",
            type: "uint128",
          },
          {
            internalType: "bool",
            name: "isPut",
            type: "bool",
          },
          {
            internalType: "address",
            name: "underlying",
            type: "address",
          },
          {
            internalType: "address",
            name: "strikeAsset",
            type: "address",
          },
          {
            internalType: "address",
            name: "collateral",
            type: "address",
          },
        ],
        internalType: "struct Types.OptionSeries",
        name: "_optionSeries",
        type: "tuple",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_price",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_orderExpiry",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_buyerAddress",
        type: "address",
      },
      {
        internalType: "bool",
        name: "_isBuyBack",
        type: "bool",
      },
      {
        internalType: "uint256[2]",
        name: "_spotMovementRange",
        type: "uint256[2]",
      },
    ],
    name: "createOrder",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "uint64",
            name: "expiration",
            type: "uint64",
          },
          {
            internalType: "uint128",
            name: "strike",
            type: "uint128",
          },
          {
            internalType: "bool",
            name: "isPut",
            type: "bool",
          },
          {
            internalType: "address",
            name: "underlying",
            type: "address",
          },
          {
            internalType: "address",
            name: "strikeAsset",
            type: "address",
          },
          {
            internalType: "address",
            name: "collateral",
            type: "address",
          },
        ],
        internalType: "struct Types.OptionSeries",
        name: "_optionSeriesCall",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "uint64",
            name: "expiration",
            type: "uint64",
          },
          {
            internalType: "uint128",
            name: "strike",
            type: "uint128",
          },
          {
            internalType: "bool",
            name: "isPut",
            type: "bool",
          },
          {
            internalType: "address",
            name: "underlying",
            type: "address",
          },
          {
            internalType: "address",
            name: "strikeAsset",
            type: "address",
          },
          {
            internalType: "address",
            name: "collateral",
            type: "address",
          },
        ],
        internalType: "struct Types.OptionSeries",
        name: "_optionSeriesPut",
        type: "tuple",
      },
      {
        internalType: "uint256",
        name: "_amountCall",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_amountPut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_priceCall",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_pricePut",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_orderExpiry",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_buyerAddress",
        type: "address",
      },
      {
        internalType: "uint256[2]",
        name: "_callSpotMovementRange",
        type: "uint256[2]",
      },
      {
        internalType: "uint256[2]",
        name: "_putSpotMovementRange",
        type: "uint256[2]",
      },
    ],
    name: "createStrangle",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "deltaLimit",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "keeper",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "liquidityPool",
    outputs: [
      {
        internalType: "contract ILiquidityPool",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "optionHandler",
    outputs: [
      {
        internalType: "contract IAlphaOptionHandler",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "proxyManager",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pullManager",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "int256",
        name: "delta",
        type: "int256",
      },
      {
        internalType: "uint256",
        name: "reactorIndex",
        type: "uint256",
      },
    ],
    name: "rebalancePortfolioDelta",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "contract IAuthority",
        name: "_newAuthority",
        type: "address",
      },
    ],
    name: "setAuthority",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "_delta",
        type: "uint256[]",
      },
      {
        internalType: "address[]",
        name: "_keeper",
        type: "address[]",
      },
    ],
    name: "setDeltaLimit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_keeper",
        type: "address",
      },
      {
        internalType: "bool",
        name: "_auth",
        type: "bool",
      },
    ],
    name: "setKeeper",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_optionHandler",
        type: "address",
      },
    ],
    name: "setOptionHandler",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_proxyManager",
        type: "address",
      },
    ],
    name: "setProxyManager",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b5060405161106938038061106983398101604081905261002f916100d1565b600080546001600160a01b0319166001600160a01b03851690811790915560405190815283907f2f658b440c35314f52658ea8a740e05b284cdc84dc9ae01e891f21b8933e7cad9060200160405180910390a150600380546001600160a01b039384166001600160a01b0319918216179091556002805492909316911617905550610114565b80516001600160a01b03811681146100cc57600080fd5b919050565b6000806000606084860312156100e657600080fd5b6100ef846100b5565b92506100fd602085016100b5565b915061010b604085016100b5565b90509250925092565b610f46806101236000396000f3fe608060405234801561001057600080fd5b50600436106100f55760003560e01c8063b342805c11610097578063e8cf860811610066578063e8cf86081461020f578063ee5ca7ae14610242578063f589826214610255578063fe7f35051461026857600080fd5b8063b342805c146101ae578063bf7e214f146101c1578063d1b9e853146101d4578063dc56726f146101e757600080fd5b806381d7273e116100d357806381d7273e146101475780638e8135c31461017557806396b4ca7014610188578063af6563aa1461019b57600080fd5b8063368ffd70146100fa578063665a11ca146101045780637a9e5e4b14610134575b600080fd5b61010261027b565b005b600354610117906001600160a01b031681565b6040516001600160a01b0390911681526020015b60405180910390f35b61010261014236600461094b565b6102de565b61016761015536600461094b565b60016020526000908152604090205481565b60405190815260200161012b565b600254610117906001600160a01b031681565b600554610117906001600160a01b031681565b6101026101a936600461094b565b61033a565b6101676101bc366004610add565b61038b565b600054610117906001600160a01b031681565b6101026101e2366004610b57565b610420565b6101fa6101f5366004610b8c565b61047a565b6040805192835260208301919091520161012b565b61023261021d36600461094b565b60046020526000908152604090205460ff1681565b604051901515815260200161012b565b610102610250366004610c7b565b61051a565b610102610263366004610ce7565b6105a4565b61010261027636600461094b565b610678565b6102836106c9565b6000805460408051630368ffd760e41b815290516001600160a01b039092169263368ffd709260048084019382900301818387803b1580156102c457600080fd5b505af11580156102d8573d6000803e3d6000fd5b50505050565b6102e66106c9565b600080546001600160a01b0319166001600160a01b0383169081179091556040519081527f2f658b440c35314f52658ea8a740e05b284cdc84dc9ae01e891f21b8933e7cad9060200160405180910390a150565b6103426106c9565b6001600160a01b0381166103695760405163e6c4247b60e01b815260040160405180910390fd5b600280546001600160a01b0319166001600160a01b0392909216919091179055565b6000610395610771565b600254604051632cd0a01760e21b81526001600160a01b039091169063b342805c906103d1908b908b908b908b908b908b908b90600401610d89565b6020604051808303816000875af11580156103f0573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906104149190610de1565b50979650505050505050565b6104286106c9565b6001600160a01b03821661044f5760405163e6c4247b60e01b815260040160405180910390fd5b6001600160a01b03919091166000908152600460205260409020805460ff1916911515919091179055565b600080610485610771565b60025460405163dc56726f60e01b81526001600160a01b039091169063dc56726f906104c7908f908f908f908f908f908f908f908f908f908f90600401610dfa565b60408051808303816000875af11580156104e5573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906105099190610e73565b50509a509a98505050505050505050565b610522610771565b60005b8381101561059d5784848281811061053f5761053f610e97565b905060200201356001600085858581811061055c5761055c610e97565b9050602002016020810190610571919061094b565b6001600160a01b031681526020810191909152604001600020558061059581610ec3565b915050610525565b5050505050565b6105ac610830565b60006105b7836108f4565b336000908152600160205260409020549091508111156105ea5760405163a6f0fbc160e01b815260040160405180910390fd5b3360009081526001602052604081208054839290610609908490610edc565b9091555050600354604051637ac4c13160e11b815260048101859052602481018490526001600160a01b039091169063f589826290604401600060405180830381600087803b15801561065b57600080fd5b505af115801561066f573d6000803e3d6000fd5b50505050505050565b6106806106c9565b6001600160a01b0381166106a75760405163e6c4247b60e01b815260040160405180910390fd5b600580546001600160a01b0319166001600160a01b0392909216919091179055565b60008054906101000a90046001600160a01b03166001600160a01b0316630c340a246040518163ffffffff1660e01b8152600401602060405180830381865afa15801561071a573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061073e9190610ef3565b6001600160a01b0316336001600160a01b03161461076f5760405163075fd2b160e01b815260040160405180910390fd5b565b6005546001600160a01b03163314801590610812575060008054906101000a90046001600160a01b03166001600160a01b0316630c340a246040518163ffffffff1660e01b8152600401602060405180830381865afa1580156107d8573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906107fc9190610ef3565b6001600160a01b0316336001600160a01b031614155b1561076f57604051631f28ddef60e11b815260040160405180910390fd5b3360009081526004602052604090205460ff161580156108d6575060008054906101000a90046001600160a01b03166001600160a01b0316630c340a246040518163ffffffff1660e01b8152600401602060405180830381865afa15801561089c573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906108c09190610ef3565b6001600160a01b0316336001600160a01b031614155b1561076f57604051631ea2564f60e31b815260040160405180910390fd5b6000600160ff1b820361091a57604051631d0742e360e21b815260040160405180910390fd5b60008212610928578161092d565b816000035b92915050565b6001600160a01b038116811461094857600080fd5b50565b60006020828403121561095d57600080fd5b813561096881610933565b9392505050565b803561097a81610933565b919050565b634e487b7160e01b600052604160045260246000fd5b60405160c0810167ffffffffffffffff811182821017156109b8576109b861097f565b60405290565b8035801515811461097a57600080fd5b600060c082840312156109e057600080fd5b6109e8610995565b9050813567ffffffffffffffff81168114610a0257600080fd5b815260208201356001600160801b0381168114610a1e57600080fd5b6020820152610a2f604083016109be565b6040820152610a406060830161096f565b6060820152610a516080830161096f565b6080820152610a6260a0830161096f565b60a082015292915050565b600082601f830112610a7e57600080fd5b6040516040810181811067ffffffffffffffff82111715610aa157610aa161097f565b8060405250806040840185811115610ab857600080fd5b845b81811015610ad2578035835260209283019201610aba565b509195945050505050565b60008060008060008060006101a0888a031215610af957600080fd5b610b0389896109ce565b965060c0880135955060e088013594506101008801359350610120880135610b2a81610933565b9250610b3961014089016109be565b9150610b49896101608a01610a6d565b905092959891949750929550565b60008060408385031215610b6a57600080fd5b8235610b7581610933565b9150610b83602084016109be565b90509250929050565b6000806000806000806000806000806102c08b8d031215610bac57600080fd5b610bb68c8c6109ce565b9950610bc58c60c08d016109ce565b98506101808b013597506101a08b013596506101c08b013595506101e08b013594506102008b013593506102208b0135610bfe81610933565b9250610c0e8c6102408d01610a6d565b9150610c1e8c6102808d01610a6d565b90509295989b9194979a5092959850565b60008083601f840112610c4157600080fd5b50813567ffffffffffffffff811115610c5957600080fd5b6020830191508360208260051b8501011115610c7457600080fd5b9250929050565b60008060008060408587031215610c9157600080fd5b843567ffffffffffffffff80821115610ca957600080fd5b610cb588838901610c2f565b90965094506020870135915080821115610cce57600080fd5b50610cdb87828801610c2f565b95989497509550505050565b60008060408385031215610cfa57600080fd5b50508035926020909101359150565b805167ffffffffffffffff1682526020808201516001600160801b0316908301526040808201511515908301526060808201516001600160a01b039081169184019190915260808083015182169084015260a09182015116910152565b8060005b60028110156102d8578151845260209384019390910190600101610d6a565b6101a08101610d98828a610d09565b60c0820188905260e0820187905261010082018690526001600160a01b038516610120830152831515610140830152610dd5610160830184610d66565b98975050505050505050565b600060208284031215610df357600080fd5b5051919050565b6102c08101610e09828d610d09565b610e1660c083018c610d09565b89610180830152886101a0830152876101c0830152866101e08301528561020083015260018060a01b038516610220830152610e56610240830185610d66565b610e64610280830184610d66565b9b9a5050505050505050505050565b60008060408385031215610e8657600080fd5b505080516020909101519092909150565b634e487b7160e01b600052603260045260246000fd5b634e487b7160e01b600052601160045260246000fd5b600060018201610ed557610ed5610ead565b5060010190565b600082821015610eee57610eee610ead565b500390565b600060208284031215610f0557600080fd5b81516109688161093356fea2646970667358221220f7ed28b60bee2d8d52b5e65498c17833ae0684e7fa092dc974c146e048f2986c64736f6c634300080e0033";

type ManagerConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: ManagerConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class Manager__factory extends ContractFactory {
  constructor(...args: ManagerConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
    this.contractName = "Manager";
  }

  deploy(
    _authority: string,
    _liquidityPool: string,
    _optionHandler: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<Manager> {
    return super.deploy(
      _authority,
      _liquidityPool,
      _optionHandler,
      overrides || {}
    ) as Promise<Manager>;
  }
  getDeployTransaction(
    _authority: string,
    _liquidityPool: string,
    _optionHandler: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(
      _authority,
      _liquidityPool,
      _optionHandler,
      overrides || {}
    );
  }
  attach(address: string): Manager {
    return super.attach(address) as Manager;
  }
  connect(signer: Signer): Manager__factory {
    return super.connect(signer) as Manager__factory;
  }
  static readonly contractName: "Manager";
  public readonly contractName: "Manager";
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): ManagerInterface {
    return new utils.Interface(_abi) as ManagerInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): Manager {
    return new Contract(address, _abi, signerOrProvider) as Manager;
  }
}

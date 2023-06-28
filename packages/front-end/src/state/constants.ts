const alphaDepositors: HexString[] = [
  "0xae563b92ea55a5f54caa5aa659290655a8adb0a5",
  "0xad4b9b6fe5d4a44395c19cdeb4ff0ba6d9025fd7",
  "0xaa2f7977f3fddbbafb9dccf6dc84c1899be135cb",
  "0x46782e3a7ed1957188b2be04717440b56a59533b",
  "0x5f77fc8ac03f02f34e991e89c549f1c8d01aba8c",
  "0xf513ac42bdfcf81446cee5731f5d63cdad2aafe7",
  "0x714d7baf5067855eba892296b6c6d94a09857010",
  "0x69f8d754c5f4f73aad00f3c22eafb77aa57ff1bc",
  "0x7811df09c3415e99beb22122123932e2fe1ef0b0",
  "0x50d52d86458f73005858a9345cf4ce89e5a6f410",
  "0x08b10b1c6d90ce438d6075cbd8a5ea26672b028b",
  "0x73a5dea042aeb13e9e9f81246281173f3ae3b0c3",
  "0xe766cc4a10fdac094e9e3e6afc35c99fc3d93ecc",
  "0xdf67361193d52ee42cb759eb98ce2c7978dd440e",
  "0x0b477cef4ccbe9f4ee26f6d2a588ade5800b1a3a",
  "0xd18c96b6cd70987189b95e02b27d98e681bba100",
  "0xdcfc11a13421171579720e0ae45e0979bb37dcd2",
  "0xaecfe4eff84a1cd9a24accc1914ac537af7f6e1b",
  "0x181cb9866f4d0489163c588dadc084768e3b7012",
  "0xf6aa21404f079e8b8e142e91fd408a86713dc087",
  "0xcd247e021f6ef24e75779fb8c4313120d86357e2",
  "0xb8f495dec49c0e875132cf462ea81f07e38f4291",
  "0xeabed8538923d8b8e0616938f8dc657f3cdf74c6",
  "0xaecfe4eff84a1cd9a24accc1914ac537af7f6e1b",
  "0x4ec5ac80991913b88035d6a0002e76c1418bf356",
  "0x00bd3bda43483af368de8b7ec6568437c7bb319f",
  "0xeabed8538923d8b8e0616938f8dc657f3cdf74c6",
  "0xdffd8bbf8dcaf236c4e009ff6013bfc98407b6c0",
  "0x87d9c2d9990a9f3a18f1377ff20d9945f9eb3792",
  "0xb1ade58c1e818a6534e3583873e70e325a00e00d",
  "0x85cb732232d986eb828fca2a94149ee12766116a",
  "0x466acff01de5d7a9c8a9ce9744618bb717e25a3b",
  "0x312d78163eb252c65cbaded0f1f72a7e2495d28a",
  "0xfb408fa20c6f6da099a7492107bc3531911896e3",
  "0xbc4649050900ef78884aa8e67a5f7d7745360843",
  "0x5fa9b5b9cde9a7d7f27e61522da3b2dd728e1ab4",
  "0x019437c32cd24996f937f40fb79eccb1635e84f6",
  "0x90f15e09b8fb5bc080b968170c638920db3a3446",
  "0x761ec6dd780312f6e5752a7cf88b341f70f3b1e1",
  "0x18303abe7808e58b92fb4015c120bf54095356de",
  "0xd0f46a5d48596409264d4efc1f3b229878fff743",
  "0x9ea278beddb85382ef23c0ff42d1c0d4d9d6d296",
  "0x05ec241639ad2aab95d0256a892e0e7e34948d0b",
  "0xaecfe4eff84a1cd9a24accc1914ac537af7f6e1b",
  "0x8fcf23e07c5484ddca4e5b2dbb95426a351df638",
  "0xdb687064091b8d2df1a02273411a03b707e20003",
  "0xdb687064091b8d2df1a02273411a03b707e20003",
  "0x0dd8a52a34e24f97d9e91474396cff3b54917ec0",
  "0xcdc8ba9815c76e838a759e932f57bf6f990a6e71",
  "0xe3881f30b0ac4027d96c42e71f2c5547c99bde8c",
  "0x50d52d86458f73005858a9345cf4ce89e5a6f410",
  "0x8542ab72e61ac4a276c69a8a18706b5cd49b38ee",
  "0xdffd8bbf8dcaf236c4e009ff6013bfc98407b6c0",
  "0x4b74d0296259f7994796e1b6e9c1c4f68066f5d6",
  "0x30beebf224372394606ffc71c38483e5ac6c9d7d",
  "0xdb687064091b8d2df1a02273411a03b707e20003",
  "0xeed468bef7d10a8f262ea1c6abc215820ad5506e",
  "0x16a3c4ab0db726bee89ad1b563b3eef21c4c0406",
  "0x8a512ece3268d8b759b3fecc221af8f63d59ab3e",
  "0x630999eee371d5c96526344ea1e513f31afb113c",
  "0x1835243a84ed1c6e663637f2fd70bfe9a3a84683",
  "0x5e18b4e94380afcc90152a3c0d0dbe2589ea9b0e",
  "0xdb687064091b8d2df1a02273411a03b707e20003",
  "0xaecfe4eff84a1cd9a24accc1914ac537af7f6e1b",
  "0xf9868b3960348194371b8ca4fe87ca7de95e40b6",
  "0x0960da039bb8151cacfef620476e8baf34bd9565",
  "0x473f22a56abf85d3a1f036df6610abeab00ebefa",
  "0x767a60f295aedd958932088f9cd6a4951d8739b6",
  "0x0baa2a67ab5195ea6d50c2d029498477337f9a98",
  "0x44c93ef1b56a58ed7289e85e25bc2488f0cd69a4",
  "0xdec08cb92a506b88411da9ba290f3694be223c26",
  "0xe3c4e290d718006c3ea4a53ab867d9d6594fdb6a",
  "0xb3cf3a3f632ab8a37ed2d628a1fc6f4a43f1c677",
  "0xdffd8bbf8dcaf236c4e009ff6013bfc98407b6c0",
  "0x761456a787fbb5f6058f78c2fbe9f561afd460a9",
  "0x8542ab72e61ac4a276c69a8a18706b5cd49b38ee",
  "0xe751970824f3bcbf97e611e351c1136776be1ce9",
  "0xb9f43e250dadf6b61872307396ad1b8beba27bcd",
  "0x900603f9376a0f19ac3212a1950d82412e01854f",
  "0x015555fe4bb264525a601e3952546795ef1a40c1",
  "0xb5e28de7fe51003cc8aac574ae65793c657d6904",
  "0x614d98a57a5d879d717152de0690ed2b04562ade",
  "0x459e9e7fa2631ce07a8369beeaebce0a660b9ecc",
  "0x5d0d809e3a201ca32a1734a1319d69a87d02173a",
  "0x143ae5ec8b018f6a4ca079d9d08fff7b296487fa",
  "0x2ed82df9e63282b32fe1a187381c0dce8b11086f",
  "0xbb902ba4f9f50875b43f8f7f5ac4f643abfd9eaa",
  "0x397cda2a1fb18d1ba5b3e270b0110e2a2f0f6b5a",
  "0xd1125f0f990f6010211b263e60998cf1614f82ce",
  "0x74812ecc3bdcf41c287d4cdb64d03f5c4a3c2818",
  "0x52cb20b8177b7af40dfc767eef28db417e899dbc",
  "0xaecfe4eff84a1cd9a24accc1914ac537af7f6e1b",
  "0x270260d230a52a9370b9f9d296668c449c73cc10",
  "0x9ea278beddb85382ef23c0ff42d1c0d4d9d6d296",
  "0x23ad1300a39d245e03f725e6be4ef64bd222194f",
  "0x2838032d8fbe767f86c3c5a300e2b379917a3476",
  "0x1fd7dae8ce6190509486e657629975e10ecfef60",
  "0x50e154ad82b3d9bfcfba58e4a6f45438e1f69cda",
  "0x630999eee371d5c96526344ea1e513f31afb113c",
  "0xc297836cf2ba5cc7dabd0d2b26f2bbad1527a009",
  "0xdffd8bbf8dcaf236c4e009ff6013bfc98407b6c0",
  "0x0531f4d8c27addb2404309977a19f9061f80a29b",
  "0x8f60d79fe3df6cd0e3a44288ad2f41af134d813e",
  "0x046c9c6fd32e7e2522e75d2675ffc647a64bc652",
  "0x43436c54d4d1b5c3bef23b58176b922bcb73fb9a",
  "0x0baa2a67ab5195ea6d50c2d029498477337f9a98",
  "0x6bda62db9be8af221a8029a73ff8bdd965166237",
  "0xd5665c8086724fb27553db61dd993da2f128ac72",
  "0x459e9e7fa2631ce07a8369beeaebce0a660b9ecc",
  "0xcdc8ba9815c76e838a759e932f57bf6f990a6e71",
  "0x01e560f15cdfd562c210680e2a6ce90c2d7bf32c",
  "0xdffd8bbf8dcaf236c4e009ff6013bfc98407b6c0",
  "0x386f6b908640d9f394ef37bc1b8c3a4018fa3db1",
  "0xdba7f615135589b545eebb1ab94a7d718c77d93e",
  "0xb39ef9e78ae92023e697561d76959dbfd3bb641e",
  "0x28416fc3c6bab062928d856d805730ab5474a47f",
  "0x4789f8ed86858dd6879104781293a98569b46b16",
  "0x79b1a32ec97537486e75d99850bd56ecfa09d643",
  "0x7feb632079bdbd8bc8b3f1df59b13d3ae62e917f",
  "0x459e9e7fa2631ce07a8369beeaebce0a660b9ecc",
  "0x8f3b0058d12b7b30edf4e51b89133198406f4dd6",
  "0x046c9c6fd32e7e2522e75d2675ffc647a64bc652",
  "0x7ba89f798bb5ff14dee2e53a39f734a656a88bc6",
  "0x79b1a32ec97537486e75d99850bd56ecfa09d643",
  "0xc440604dac90d672838d69b99d17bdb14e55d5b8",
  "0xe96664029ad91b2d9928bbcab585450f78eff8cc",
  "0x525b3742517bc3d034e3af7b5202cb79a9cfd5a0",
  "0xaafdd768fa83ef7af0e19707f2be9d1db1924766",
  "0xb3875eb64faf2881e3abc48e5a96bb66ffe6f100",
  "0x015555fe4bb264525a601e3952546795ef1a40c1",
  "0xd88b4a0db6b39efa643be502fe42126cd9c5daf8",
  "0xe6cf807e4b2a640dfe03ff06fa6ab32c334c7df4",
  "0x630999eee371d5c96526344ea1e513f31afb113c",
  "0xa1ed85d7a59bbb55d285d9c63bf328ec9917399b",
  "0xaecfe4eff84a1cd9a24accc1914ac537af7f6e1b",
  "0x9401df71b22eb8fee6d89e25905308c06afb5b81",
  "0xd5e3688b1118cca6539b3aedda3f8d9f9037df56",
  "0xe55c9840eb6ba1c75160ed611e3c72bc438dca54",
  "0x09d55f3b69476a7af1aa0c72598ea8850f20181f",
  "0x35f49e54d13b4cf6b4aa5f2fa895c51ce1984b6b",
  "0xdffd8bbf8dcaf236c4e009ff6013bfc98407b6c0",
  "0x74ea2a2f3491801d93a869f154d5e4cea2abaec9",
  "0xb69dc34f83b0a1a37ae105b76db62b74f68749e8",
  "0x91485c87554716011f7738246899bc7b383d8bb6",
  "0x3bfb3a55c7190ead733cd7b5a7dc80b2d9e9baba",
  "0x30beebf224372394606ffc71c38483e5ac6c9d7d",
  "0xdae6f0dc613de35704cb79dceeb620bd493e4660",
  "0x76d2ddce6b781e66c4b184c82fbf4f94346cfb0d",
  "0x15906710f1977af7a51fc339aab7ef38c848094a",
  "0x7811df09c3415e99beb22122123932e2fe1ef0b0",
  "0x87d9c2d9990a9f3a18f1377ff20d9945f9eb3792",
  "0x79b1a32ec97537486e75d99850bd56ecfa09d643",
  "0x7f2466ae8badee7dc0109edd0b6dde08c432236c",
  "0x42f6d5a50091b1effe737e8211a336dbdbe89617",
  "0x8542ab72e61ac4a276c69a8a18706b5cd49b38ee",
  "0x9ceb74705af54d217712132e8eff7a543b934cef",
  "0xd9d55c3f12afdb62456432641a225f33c0ee71a8",
  "0xbb902ba4f9f50875b43f8f7f5ac4f643abfd9eaa",
  "0x630999eee371d5c96526344ea1e513f31afb113c",
  "0x7663697900dd93a6d4722bc150d8e3a03c7b4866",
  "0x3a212d3d7504dc4a39e21c731d0e80b114a2108b",
  "0xdffd8bbf8dcaf236c4e009ff6013bfc98407b6c0",
  "0x86149cd80ff8ba161fedec4490368e813ad974e3",
  "0x84d5179e0e47e19b8d5f32b8cf03a7b9b3164327",
  "0x22c13d496c67b258a99057823efd2647f46aefd2",
  "0x3a212d3d7504dc4a39e21c731d0e80b114a2108b",
  "0x7b2b13fd21784009bcb58b2c79ed3c898a8a399f",
  "0x14fcb569cb92065119a48f59a532e8330b7cf6ba",
  "0xf948e6ab3deb56f1bd5bea5c248124d1335190c8",
  "0x7d8e4b2b6a436f55c67a3001c1a9a6a219f3e1d3",
  "0xbe478151e2070b9d468de42ebf34275a9f35bf32",
  "0x7811df09c3415e99beb22122123932e2fe1ef0b0",
  "0xe0f61822b45bb03cdc581283287941517810d7ba",
  "0xdffd8bbf8dcaf236c4e009ff6013bfc98407b6c0",
  "0x9b441ff1a562127b7a7ecdf746c08cc35f6aa790",
  "0x4a701886ce11519b8c6f4638c3c701725f053125",
  "0xa6f473548cb679d60cebf7c00e9b37816f0b1e17",
  "0x056351ac8cc979fce150ee1468e1d5baf0d58ce3",
  "0x00bd3bda43483af368de8b7ec6568437c7bb319f",
  "0x37de18fe52bf74ae3078f5b4a05ad6a5e344a036",
  "0x08372ebdb613e4c60f5d110362a5e854613d1e54",
  "0xaecfe4eff84a1cd9a24accc1914ac537af7f6e1b",
  "0x0960da039bb8151cacfef620476e8baf34bd9565",
  "0x7b2b13fd21784009bcb58b2c79ed3c898a8a399f",
  "0xa161a6290d129298fcac68aa1113293a0462c931",
  "0xb9f43e250dadf6b61872307396ad1b8beba27bcd",
  "0x43c0ceb490150328dccf9d6f17404592d0a247ed",
  "0xba6a4c5ab6893560e88cfe8560f06191ddc1bdfb",
  "0xdffd8bbf8dcaf236c4e009ff6013bfc98407b6c0",
  "0x7ab066bcd945264e1b1c8d451cb3517c973e676c",
  "0xbe478151e2070b9d468de42ebf34275a9f35bf32",
  "0xa46c96b8f403d4be5a98b01ff1da8f06c4beabef",
  "0xb3cf3a3f632ab8a37ed2d628a1fc6f4a43f1c677",
  "0xa9e178c61fd9288d6c80f7bd0636030c247a8b0e",
  "0x104e6ef09982a5590f018d6e062675497ad16ad9",
  "0x39c6e0a78fc2944ccf11386dc2b9e614f7d6528e",
  "0x7811df09c3415e99beb22122123932e2fe1ef0b0",
  "0x87d2543617c9839d048abcf5b26d7f073b6a8826",
  "0xcbee45be38b32d42c213e2591ffc3b2b24ffc97c",
  "0xa41c78cd9973ff23878bce328afbea61c94abbdb",
  "0x4d58d36e46cf9af14e416061fe5d0074780b4099",
  "0x4edb5dd988b78b40e1b38592a4761f694e05ef05",
  "0x87d9c2d9990a9f3a18f1377ff20d9945f9eb3792",
  "0xb39ef9e78ae92023e697561d76959dbfd3bb641e",
  "0xdffd8bbf8dcaf236c4e009ff6013bfc98407b6c0",
  "0xaecfe4eff84a1cd9a24accc1914ac537af7f6e1b",
  "0xaecfe4eff84a1cd9a24accc1914ac537af7f6e1b",
  "0x22c13d496c67b258a99057823efd2647f46aefd2",
  "0x4a701886ce11519b8c6f4638c3c701725f053125",
  "0xaecfe4eff84a1cd9a24accc1914ac537af7f6e1b",
  "0x1cf6bff83de92a32cf0f1ed55485a0a081972be7",
  "0xc08922a77140ce1aa91d419f4ac2ddc853575511",
  "0x2d4dbb65bfeb78bf33db8381b381f7e909a395be",
  "0x9ea278beddb85382ef23c0ff42d1c0d4d9d6d296",
  "0xfb408fa20c6f6da099a7492107bc3531911896e3",
  "0xe751970824f3bcbf97e611e351c1136776be1ce9",
  "0x54dd4659fc34d8763c772aef0e810d6e7c376229",
  "0xa68b7ee3af66097263ddb943d1a46ab546050ff1",
  "0x906e227180da78f5343bfa187c0aad972934694a",
  "0xdffd8bbf8dcaf236c4e009ff6013bfc98407b6c0",
  "0xb39ef9e78ae92023e697561d76959dbfd3bb641e",
  "0xe0b7cf9b0bff9e0eaae439b3c054f8fd8f683d52",
  "0xd3a1164056c14cabaf3476d4e1b763ed37bc75bf",
  "0xb1ade58c1e818a6534e3583873e70e325a00e00d",
  "0x97b102e00d88f02debfd6b1e4b901dd6931bb982",
  "0xcf02885c7a60f8574f6d1ada3c2fc8bfe44d4891",
  "0x477ea3f48c3d296eb6ecd42c2f69cdf28eb622bf",
  "0x7811df09c3415e99beb22122123932e2fe1ef0b0",
  "0xf67921de8a59d0ec64e2943d55d51dcbf9b96ee1",
  "0xdec756626f1783fa23291e2c5d1d6a391fdaa559",
  "0xb8b0cc3793bbbfdb997fec45828f172e5423d3e2",
  "0xaecfe4eff84a1cd9a24accc1914ac537af7f6e1b",
  "0x3461551e8a9d68314fdd43eb81f98044da4a1461",
  "0x92d97f86afa95d16405e7210ab55581bb3bd1276",
  "0x270260d230a52a9370b9f9d296668c449c73cc10",
  "0xc051b37c2b4f103d397074eee54573765df83a72",
  "0x5b1b88f5384e1edd98d1da38d8271bb5158e2fe9",
  "0xc10898eda672fdfc4ac0228bb1da9b2bf54c768f",
  "0xe3881f30b0ac4027d96c42e71f2c5547c99bde8c",
  "0x03e276c6f75dfe07f081dd697510125164375ccb",
  "0xb9f43e250dadf6b61872307396ad1b8beba27bcd",
  "0xa38cdb63c943e9481c9b87db5c80f5ac333d16ed",
  "0x4001f9230126f0cc7e5a85d7e4afd29c2d705d27",
  "0x41e983218e09e231ce2cb334c14f980353704718",
  "0xbb8694519bc68b337663f0bdbe79847b49000b6b",
  "0x6e8a66a3ceebb51697ee2120d433e2db8affe0cd",
  "0xd2be832911a252302bac09e30fc124a405e142df",
  "0xa25d315e0770a6356c4524d8106c362bfba61092",
  "0xcbee45be38b32d42c213e2591ffc3b2b24ffc97c",
  "0xd3a1164056c14cabaf3476d4e1b763ed37bc75bf",
  "0x01f8daa42ca7e4b2e01e39b034058919ead5a8f3",
  "0x92cda9840dcb28bd855f412fe3153b8260643c22",
  "0x57d95774deec127ee020529d3b34e655b5c6ae58",
  "0xb4ffa2b1fb4521ce8ba9d7606b2d6dadc5c4cad8",
  "0x6ee25007b73fa79902a152a78cab50f4f7fa9eff",
  "0xc249e74480aed4f9219b0617ae09dceb748571f7",
];

const degenscoreDepositors: HexString[] = [];

const testAddresses: HexString[] = [
  "0xc051B37C2B4f103d397074EeE54573765dF83A72",
  "0x900603f9376A0F19ac3212A1950D82412e01854F",
  "0x17A80e497CC1BAc48df98828eeeaCBf3A3824B6d",
  "0xc921FF4f9254D592C1B87FD569774b8De0a809af",
  "0xB69dc34F83B0a1A37AE105B76dB62B74f68749e8",
  "0x953B18a294332C0837FF8c5b08E54B1555871e4b",
  "0x99EFf2f8c7Ebd3E05ffc09c6AAA4EDdEc7831065",
];

export const LP_WHITELIST: HexString[] = [
  ...alphaDepositors,
  ...degenscoreDepositors,
  ...testAddresses,
];

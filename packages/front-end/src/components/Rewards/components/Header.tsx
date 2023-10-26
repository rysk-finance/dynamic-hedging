export const Header = () => (
  <section className="grid grid-cols-2 font-parabole">
    <div>
      <h1 className="text-4xl mb-4">{`Rysk Rewards`}</h1>
      <h2 className="text-xl ml-[3px]">{`Earn rewards for LPing and Trading on Rysk`}</h2>
    </div>

    <img
      alt="Rysk logo"
      className="h-24 m-auto"
      src={"/logo-animated.gif"}
      title="Rysk: Uncorrelated Returns"
    />
  </section>
);

import React from "react";
import { Currency, Order } from "../../types";
import { BigNumberDisplay } from "../BigNumberDisplay";
import { AddressDisplay } from "../shared/AddressDisplay";
import { OptionSeriesInfo } from "../shared/OptionSeriesInfo";

type OrderDetailsProps = {
  order: Order | null;
};

export const OrderDetails: React.FC<OrderDetailsProps> = ({ order }) => {
  return (
    <div className="w-full">
      {order && (
        <>
          <OptionSeriesInfo option={order.optionSeries} />
          <hr className="my-2 border-black" />
          <p>
            Buyer Address: <AddressDisplay>{order.buyer}</AddressDisplay>
          </p>
          <p>
            Amount:{" "}
            <BigNumberDisplay currency={Currency.RYSK}>
              {order.amount}
            </BigNumberDisplay>
          </p>
          <p>
            Total Price:{" "}
            <BigNumberDisplay currency={Currency.RYSK} suffix="USDC">
              {order.price}
            </BigNumberDisplay>
          </p>
        </>
      )}
    </div>
  );
};

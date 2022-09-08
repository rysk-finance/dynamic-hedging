
import React from "react";
import { BIG_NUMBER_DECIMALS } from "../../config/constants";
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
            Size:{" "}
            <BigNumberDisplay currency={Currency.RYSK}>
              {order.amount}
            </BigNumberDisplay>
          </p>
          <p>
            Price per option:{" "}
            <BigNumberDisplay currency={Currency.RYSK} suffix="USDC">
              {order.price}
            </BigNumberDisplay>
          </p>
        </>
      )}
    </div>
  );
};
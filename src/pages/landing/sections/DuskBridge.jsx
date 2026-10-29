import React from "react";

const A = "/landing/";

/* Daylight cream slides down through peach and violet into night. */
export default function DuskBridge() {
  return (
    <div className="lp-dusk" aria-hidden="true">
      <img className="lp-dusk-cloud lp-dusk-a" src={`${A}cloud-4.webp`} width="453" height="288" alt="" loading="lazy" decoding="async" />
      <img className="lp-dusk-cloud lp-dusk-b" src={`${A}cloud-2.webp`} width="639" height="322" alt="" loading="lazy" decoding="async" />
      <img className="lp-dusk-cloud lp-dusk-c" src={`${A}cloud-5.webp`} width="434" height="237" alt="" loading="lazy" decoding="async" />
    </div>
  );
}

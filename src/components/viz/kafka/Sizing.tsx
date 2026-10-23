"use client";

import { useState } from "react";
import { C, Narration, Slider, Stat } from "../kit";

const fmtMB = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB/s` : `${mb.toFixed(0)} MB/s`);
const fmtTB = (tb: number) => (tb >= 1000 ? `${(tb / 1000).toFixed(1)} PB` : `${tb.toFixed(1)} TB`);

export default function Sizing() {
  const [write, setWrite] = useState(200); // MB/s produced
  const [groups, setGroups] = useState(3); // consumer groups reading everything
  const [days, setDays] = useState(7);
  const [rf, setRf] = useState(3);
  const [perPartProd, setPerPartProd] = useState(10); // MB/s a producer can push to one partition
  const [perPartCons, setPerPartCons] = useState(5); // MB/s one consumer instance processes
  const [diskTb, setDiskTb] = useState(12); // usable disk per broker
  const [nicMB, setNicMB] = useState(1250); // 10 Gbit/s ≈ 1250 MB/s

  const head = 0.6; // keep 40 % headroom for failures, rebalances and spikes
  const partitions = Math.ceil(Math.max(write / perPartProd, write / perPartCons) * 1.5);
  const storageTb = (write * 86400 * days * rf) / 1024 / 1024;
  const inMB = write * rf; // leader writes + follower replication arriving at brokers, cluster-wide
  const outMB = write * groups + write * (rf - 1); // consumers + replication reads
  const byDisk = Math.ceil(storageTb / (diskTb * head));
  const byNet = Math.ceil(Math.max(inMB, outMB) / (nicMB * head));
  const brokers = Math.max(rf, byDisk, byNet);
  const limit = byDisk >= byNet && byDisk >= rf ? "disk" : byNet >= rf ? "network" : "replication factor";
  const perBroker = Math.ceil((partitions * rf) / brokers);

  return (
    <div className="space-y-4">
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        <Slider label="produce throughput" value={write} min={10} max={4000} step={10} onChange={setWrite} format={fmtMB} />
        <Slider label="consumer groups reading all data" value={groups} min={1} max={12} onChange={setGroups} />
        <Slider label="retention" value={days} min={1} max={30} onChange={setDays} format={(v) => `${v} days`} />
        <Slider label="replication factor" value={rf} min={1} max={5} onChange={setRf} />
        <Slider label="producer MB/s per partition" value={perPartProd} min={1} max={50} onChange={setPerPartProd} />
        <Slider label="consumer MB/s per partition" value={perPartCons} min={1} max={50} onChange={setPerPartCons} />
        <Slider label="usable disk per broker" value={diskTb} min={1} max={48} onChange={setDiskTb} format={(v) => `${v} TB`} />
        <Slider label="broker NIC" value={nicMB} min={125} max={3125} step={125} onChange={setNicMB} format={(v) => `${((v * 8) / 1000).toFixed(0)} Gbit/s`} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="partitions" value={partitions} color={C.active} />
        <Stat label="stored (× RF)" value={fmtTB(storageTb)} />
        <Stat label="brokers" value={brokers} color={C.done} />
        <Stat label="replicas / broker" value={perBroker} color={perBroker > 4000 ? C.bad : C.text} />
      </div>

      <div className="rounded-xl border border-line bg-panel p-3 font-mono text-[11px] leading-relaxed text-dim">
        <div>
          partitions = max(T / p_prod, T / p_cons) × 1.5 growth = max({(write / perPartProd).toFixed(0)}, {(write / perPartCons).toFixed(0)}) × 1.5 → <b className="text-ink">{partitions}</b>
        </div>
        <div>
          storage = {write} MB/s × 86,400 s × {days} d × RF {rf} → <b className="text-ink">{fmtTB(storageTb)}</b> → {byDisk} broker(s) at 60% disk
        </div>
        <div>
          network in = T × RF = {fmtMB(inMB)} · out = T × groups + T × (RF−1) = {fmtMB(outMB)} → {byNet} broker(s) at 60% NIC
        </div>
        <div>
          brokers = max(RF, disk, network) = <b className="text-ink">{brokers}</b> (bound by {limit})
        </div>
      </div>

      <Narration tone={rf < 3 ? "bad" : perBroker > 4000 ? "warn" : "info"}>
        {rf < 3
          ? "RF below 3 can't survive one broker down and still accept acks=all writes with min.insync.replicas=2. Use RF=3 in production."
          : perBroker > 4000
            ? "That's a lot of partition replicas per broker. Every replica costs file handles, memory and recovery time. Add brokers or rethink the partition count (KRaft raises cluster-wide limits, but per-broker costs remain)."
            : `This cluster is bound by ${limit}. Partition count is hard to change later (adding partitions remaps keys), so size for 1–2 years of growth. Tiered storage moves old segments to object storage and cuts the disk bound dramatically.`}
      </Narration>
    </div>
  );
}

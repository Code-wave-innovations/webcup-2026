import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { POIS } from '../cityConfig'
import { relief } from '../layout/relief'
import { createFlightSample, CROUCH_SECONDS, flightQuaternion, planExit, planFlight, sampleFlight, type FlightPlan, type FlightSample } from './flightPath'

const ground = (x: number, z: number) => Math.max(relief(x, z), 0)
const spot = (x: number, z: number) => new Vector3(x, ground(x, z), z)
const DT = 1 / 60

function fly(plan: FlightPlan, visit: (sample: FlightSample, previous: FlightSample, t: number) => void) {
  let previous = sampleFlight(plan, 0, createFlightSample())
  for (let t = DT; t <= plan.duration + DT; t += DT) {
    const sample = sampleFlight(plan, t, createFlightSample())
    visit(sample, previous, t)
    previous = sample
  }
}

const wrap = (a: number) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2))

describe('planFlight', () => {
  const [golf, stade, villageEst, villageNord] = POIS
  const trips = [
    [new Vector3(-8, 22, 120), spot(golf.x, golf.z)],
    [spot(golf.x, golf.z), spot(villageNord.x, villageNord.z)],
    [spot(stade.x, stade.z), spot(villageEst.x, villageEst.z)],
  ] as const

  it('goes through crouch, take-off, cruise, flare and landing in that order', () => {
    const plan = planFlight(trips[0][0], trips[0][1], 0)
    const order = ['crouch', 'takeoff', 'cruise', 'flare', 'landing']
    let at = 0
    fly(plan, (sample) => {
      const index = order.indexOf(sample.phase)
      expect(index).toBeGreaterThanOrEqual(at)
      at = index
    })
    expect(at).toBe(4)
  })

  it('moves continuously, never faster than its top speed allows', () => {
    for (const [from, to] of trips) {
      const plan = planFlight(from, to, 1)
      fly(plan, (sample, previous) => {
        expect(sample.position.distanceTo(previous.position)).toBeLessThan(plan.speed * DT * 1.05 + 1e-3)
      })
    }
  })

  it('stays above the ground all the way, and well above it while cruising', () => {
    for (const [from, to] of trips) {
      fly(planFlight(from, to, 0), (sample) => {
        const floor = ground(sample.position.x, sample.position.z)
        expect(sample.position.y).toBeGreaterThan(floor - 0.05)
        if (sample.phase === 'cruise') expect(sample.position.y).toBeGreaterThan(floor + 10)
      })
    }
  })

  it('clears the skyline it is given', () => {
    const tower = (x: number, z: number) => (Math.hypot(x - 30, z - 60) < 6 ? 80 : ground(x, z))
    fly(planFlight(spot(0, 100), spot(60, 20), 0, tower), (sample) => {
      if (sample.phase === 'cruise') expect(sample.position.y).toBeGreaterThan(tower(sample.position.x, sample.position.z) + 5)
    })
  })

  it('lands on the spot, slow, upright', () => {
    const [from, to] = trips[1]
    const plan = planFlight(from, to, 0)
    const touchdown = sampleFlight(plan, plan.arrival - 0.02, createFlightSample())
    expect(touchdown.position.distanceTo(to)).toBeLessThan(0.2)
    expect(touchdown.velocity.length()).toBeLessThan(4)
    expect(touchdown.pitch).toBeLessThan(0.2)
    const landed = sampleFlight(plan, plan.duration, createFlightSample())
    expect(landed.phase).toBe('landing')
    expect(landed.position.distanceTo(to)).toBeLessThan(1e-6)
  })

  it('turns smoothly: no jump of heading, pitch or bank between two frames', () => {
    for (const [from, to] of trips) {
      fly(planFlight(from, to, Math.PI), (sample, previous) => {
        expect(Math.abs(wrap(sample.yaw - previous.yaw))).toBeLessThan(0.25)
        expect(Math.abs(sample.pitch - previous.pitch)).toBeLessThan(0.15)
        expect(Math.abs(sample.roll - previous.roll)).toBeLessThan(0.15)
      })
    }
  })

  it('lies along the flight while cruising, head first', () => {
    const plan = planFlight(trips[0][0], trips[0][1], 0)
    const t = CROUCH_SECONDS + plan.accel + plan.cruise / 2
    const sample = sampleFlight(plan, t, createFlightSample())
    expect(sample.phase).toBe('cruise')
    expect(sample.pitch).toBeGreaterThan(1.2)
    // Nova's head (local +Y) points along the velocity
    const head = new Vector3(0, 1, 0).applyQuaternion(flightQuaternion(sample.yaw, sample.pitch, sample.roll, new Quaternion()))
    expect(head.dot(sample.velocity.clone().normalize())).toBeGreaterThan(0.8)
  })
})

describe('flightQuaternion', () => {
  it('banks into the turn: the back tilts towards the centre of the turn', () => {
    // a curve turning left (towards +X from a +Z heading)
    const plan = planFlight(new Vector3(0, 30, 0), new Vector3(140, 30, 160), 0)
    fly(plan, (sample, previous, t) => {
      if (sample.phase !== 'cruise' || Math.abs(sample.roll) < 0.1 || t < 0.1) return
      const turn = wrap(sample.yaw - previous.yaw)
      const back = new Vector3(0, 0, -1).applyQuaternion(flightQuaternion(sample.yaw, sample.pitch, sample.roll, new Quaternion()))
      const left = new Vector3(Math.cos(sample.yaw), 0, -Math.sin(sample.yaw))
      expect(Math.sign(back.dot(left))).toBe(Math.sign(turn))
    })
  })
})

describe('planExit', () => {
  it('climbs straight up and out of the frame', () => {
    const from = spot(POIS[0].x, POIS[0].z)
    const plan = planExit(from, 0.4)
    expect(plan.lands).toBe(false)
    const end = sampleFlight(plan, plan.duration, createFlightSample())
    expect(end.position.y - from.y).toBeGreaterThan(120)
    const early = sampleFlight(plan, CROUCH_SECONDS + 0.6, createFlightSample())
    expect(Math.hypot(early.position.x - from.x, early.position.z - from.z)).toBeLessThan(1.5)
    expect(early.pitch).toBeLessThan(0.3)
  })
})

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useDistricts } from '../../api/districts'
import { messageFor } from '../../api/errors'
import { useSessionUser } from '../../api/session'
import { useTransitLines, useTransitStops, useTransitStopsDepartures } from '../../api/transit'
import { LineBadge } from '../../features/transit/LineBadge'
import { LineSheet } from '../../features/transit/LineSheet'
import { NetworkStatus } from '../../features/transit/NetworkStatus'
import { StopDepartures } from '../../features/transit/StopDepartures'
import styles from '../../features/transit/Transit.module.css'
import { useFavoriteStops } from '../../features/transit/useFavoriteStops'
import { ButtonRouteLink } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { GlassPanel } from '../../ui/GlassPanel'
import { RowButton } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'

/**
 * F36: municipal transport on one screen. Network status, the next departures at the resident's stops
 * (chosen stop, favourites, then their district's) and the search; a line opens on the same screen (`?ligne=`).
 * The state lives in the URL: ?ligne=T1, ?arret=<id>, ?quartier=<id>, ?q=.
 */
export default function TransportsPage() {
  const [params, setParams] = useSearchParams()
  const user = useSessionUser()
  const favorites = useFavoriteStops()
  const districts = useDistricts()

  const lineCode = params.get('ligne')?.toUpperCase() || undefined
  const chosenStop = Number(params.get('arret')) || undefined
  const districtId = Number(params.get('quartier')) || user?.district_id || undefined
  const q = params.get('q') ?? ''
  const [search, setSearch] = useState(q)

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    if (search.trim() === q) return
    const timer = setTimeout(() => update({ q: search.trim() || null }), 300)
    return () => clearTimeout(timer)
    // the typed text is the only trigger; update is recreated every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const openLine = (code: string) => update({ ligne: code })
  const openStop = (id: number) => {
    update({ arret: String(id) })
    document.getElementById('mes-arrets')?.scrollIntoView({ block: 'start' })
  }

  // my stops: the one picked in the search, then favourites, then the district's, without duplicates
  const districtStops = useTransitStops({ district_id: districtId }, districtId !== undefined)
  const stopIds = [...new Set([chosenStop, ...favorites.ids, ...(districtStops.data ?? []).map((stop) => stop.id)])].filter(
    (id): id is number => id !== undefined,
  )
  const departures = useTransitStopsDepartures(stopIds)
  const tagOf = (id: number) => (id === chosenStop ? 'Arrêt recherché' : favorites.ids.includes(id) ? 'Mon arrêt' : undefined)

  const lines = useTransitLines()
  const stopResults = useTransitStops({ q }, q.length > 0)
  const needle = q.toLowerCase()
  const lineResults = q ? (lines.data ?? []).filter((line) => line.code.toLowerCase().includes(needle) || line.name.toLowerCase().includes(needle)) : []

  return (
    <ConsolePage
      title="Transports"
      lead="L’état du réseau, les prochains départs à vos arrêts et les horaires de chaque ligne, sur un seul écran. Mis à jour chaque minute."
    >
      {lineCode && <LineSheet key={lineCode} code={lineCode} onClose={() => update({ ligne: null })} />}

      <section className={styles.section} aria-labelledby="reseau">
        <h2 id="reseau">État du réseau</h2>
        <NetworkStatus onOpenLine={openLine} />
      </section>

      <section className={styles.section} aria-labelledby="mes-arrets">
        <h2 id="mes-arrets">Prochains départs près de chez moi</h2>
        <div className={styles.toolbar}>
          <div className={styles.grow}>
            <Field label="Quartier" htmlFor="transport-quartier">
              <select id="transport-quartier" value={districtId ?? ''} onChange={(event) => update({ quartier: event.target.value || null })}>
                <option value="">Choisir un quartier</option>
                {districts.data?.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {chosenStop && (
            <button type="button" className={styles.textButton} onClick={() => update({ arret: null })}>
              Retirer l’arrêt recherché
            </button>
          )}
        </div>
        {!favorites.canSave && <p className={text.note}>Connectez-vous pour enregistrer vos arrêts favoris : ils s’afficheront en premier.</p>}
        {favorites.error && <p className={text.error}>{messageFor(favorites.error)}</p>}
        {districtStops.isError && <p className={text.error}>{messageFor(districtStops.error)}</p>}

        {stopIds.length === 0 ? (
          <GlassPanel>
            <p>{districtId ? 'Aucun arrêt dans ce quartier.' : 'Choisissez votre quartier ou cherchez un arrêt pour voir les prochains départs.'}</p>
          </GlassPanel>
        ) : (
          <div className={styles.stops}>
            {stopIds.map((id, index) => (
              <StopDepartures
                key={id}
                query={departures[index]}
                tag={tagOf(id)}
                onOpenLine={openLine}
                favorite={
                  favorites.canSave
                    ? { active: favorites.ids.includes(id), disabled: favorites.saving, onToggle: () => favorites.toggle(id) }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="chercher">
        <h2 id="chercher">Chercher un arrêt ou une ligne</h2>
        <Field label="Nom de l’arrêt, de la ligne ou de la rue" htmlFor="transport-q">
          <input id="transport-q" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex. Grand Dôme, T1" />
        </Field>
        {stopResults.isError && <p className={text.error}>{messageFor(stopResults.error)}</p>}
        {q && stopResults.data && lineResults.length === 0 && stopResults.data.length === 0 && <p className={text.note}>Aucun arrêt ni ligne ne correspond.</p>}
        {(lineResults.length > 0 || (!!q && !!stopResults.data?.length)) && (
          <ul className={styles.results} aria-label="Résultats">
            {lineResults.map((line) => (
              <li key={`line-${line.id}`}>
                <RowButton onClick={() => openLine(line.code)}>
                  <LineBadge line={line} />
                  <small>Voir la ligne</small>
                </RowButton>
              </li>
            ))}
            {q &&
              stopResults.data?.map((stop) => (
                <li key={`stop-${stop.id}`}>
                  <RowButton onClick={() => openStop(stop.id)}>
                    <span>
                      <strong>{stop.name}</strong>
                      <small>
                        {[stop.district?.name, stop.lines.map((line) => line.code).join(', ')].filter(Boolean).join(' · ')}
                      </small>
                    </span>
                    <small>Prochains départs</small>
                  </RowButton>
                </li>
              ))}
          </ul>
        )}
        {!q && lines.data && (
          <div className={styles.lineLinks}>
            {lines.data.map((line) => (
              <button key={line.id} type="button" className={styles.lineChip} onClick={() => openLine(line.code)}>
                <LineBadge line={line} />
              </button>
            ))}
          </div>
        )}
      </section>

      <div>
        <ButtonRouteLink to="/ville" variant="ghost" small>
          Retour à l’accueil
        </ButtonRouteLink>
      </div>
    </ConsolePage>
  )
}

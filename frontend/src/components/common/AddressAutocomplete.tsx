import { useEffect, useRef } from 'react'
import { Input, type InputProps } from '@chakra-ui/react';
import { loadGoogleMaps } from '@/utils/googleMaps'

type Props = Omit<InputProps, 'onChange' | 'value'> & {
  value: string
  onChange: (val: string) => void
  onPlaceSelected?: (payload: { address: string; lat?: number; lng?: number }) => void
  /** Optional country restriction, e.g. "IL" or "US,CA" */
  countries?: string
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  countries,
  ...rest
}: Props) {
  const ref = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let autocomplete: google.maps.places.Autocomplete | null = null
    let listener: google.maps.MapsEventListener | null = null

    loadGoogleMaps().then((g) => {
      if (!ref.current) return

      const opts: google.maps.places.AutocompleteOptions = {
        fields: ['formatted_address', 'geometry', 'place_id'],
        types: ['geocode'],
      }

      // Add country restriction if provided
      if (countries) {
        const list = countries.split(',').map((s) => s.trim()).filter(Boolean)
        // Typings are loose here; this is the correct runtime shape.
        // ts-expect-error componentRestrictions isn't fully typed
        opts.componentRestrictions = { country: list.length <= 1 ? list[0] : list }
      }

      autocomplete = new g.maps.places.Autocomplete(ref.current!, opts)

      listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete!.getPlace()
        const address = place.formatted_address || ref.current!.value
        const lat = place.geometry?.location?.lat()
        const lng = place.geometry?.location?.lng()
        onChange(address)
        onPlaceSelected?.({ address, lat, lng })
      })
    })

    return () => {
      listener?.remove()
    }
  }, [onChange, onPlaceSelected, countries])

  return (
    <Input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search address"
      {...rest}
    />
  )
}

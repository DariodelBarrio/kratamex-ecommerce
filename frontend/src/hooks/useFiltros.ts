import { useState } from 'react'

export type OrdenPrecio = '' | 'asc' | 'desc'

export function useFiltros() {
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [ordenPrecio, setOrdenPrecio] = useState<OrdenPrecio>('')
  const [filtrarFavoritos, setFiltrarFavoritos] = useState(false)
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')

  const limpiarFiltros = () => {
    setBusqueda('')
    setCategoriaFiltro('')
    setOrdenPrecio('')
    setFiltrarFavoritos(false)
    setPrecioMin('')
    setPrecioMax('')
  }

  const hayFiltrosActivos = !!(busqueda || categoriaFiltro || ordenPrecio || filtrarFavoritos || precioMin || precioMax)

  return {
    busqueda, setBusqueda,
    categoriaFiltro, setCategoriaFiltro,
    ordenPrecio, setOrdenPrecio,
    filtrarFavoritos, setFiltrarFavoritos,
    precioMin, setPrecioMin,
    precioMax, setPrecioMax,
    limpiarFiltros,
    hayFiltrosActivos,
  }
}

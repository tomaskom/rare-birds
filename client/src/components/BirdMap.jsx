/**
 * Copyright (C) 2025 Michelle Tomasko
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * Project: rare-birds
 * Description: Map for eBird records of rare bird sightings
 * 
 * Dependencies:
 * - OpenStreetMap data © OpenStreetMap contributors (ODbL)
 * - Leaflet © 2010-2024 Vladimir Agafonkin (BSD-2-Clause)
 * - eBird data provided by Cornell Lab of Ornithology
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { MapContainer, TileLayer, useMapEvents, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import _ from 'lodash';

// Marker icon workaround for React-Leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Icon for single bird sightings
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Create a special icon for locations with multiple birds
const MultipleIcon = L.divIcon({
  className: 'custom-div-icon',
  html: '<div style="background-color: #3B82F6; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 2px solid white;">+</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Memoized popup content component
const BirdPopupContent = memo(({ birds }) => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  return (
    <>
      {selectedPhoto && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          cursor: 'pointer'
        }} onClick={() => setSelectedPhoto(null)}>
          <img 
            src={selectedPhoto} 
            alt="Full size bird" 
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain'
            }}
          />
        </div>
      )}
      <div style={{ 
        maxHeight: '225px', 
        overflowY: 'auto',
        transform: 'translateZ(0)'
      }}>
        <h3 style={{ 
          fontWeight: 'bold', 
          marginBottom: '-0.25rem',
          padding: '0',
        }}>
          {birds.length} {birds.length === 1 ? 'Bird' : 'Birds'} at this location
        </h3>
        {birds.map((bird, birdIndex) => (
          <div 
            key={`${bird.speciesCode}-${birdIndex}`}
            style={{ 
              borderBottom: birdIndex < birds.length - 1 ? '1px solid #e2e8f0' : 'none',
              padding: '0',
              paddingTop: '0.25rem',
              paddingBottom: '0.25rem'
            }}
          >
            <h4 style={{ fontWeight: 'bold' }}>{bird.comName}</h4>
            {bird.thumbnailUrl && (
              <img
                src={bird.thumbnailUrl}
                alt={bird.comName}
                style={{
                  width: '100px',
                  height: '75px',
                  objectFit: 'cover',
                  cursor: 'pointer',
                  marginBottom: '0.25rem',
                  borderRadius: '4px'
                }}
                onClick={() => setSelectedPhoto(bird.fullPhotoUrl)}
              />
            )}
            <p style={{ fontSize: '0.9em', color: '#4B5563', margin: '0.25rem' }}>
              Last Observed: {new Date(bird.obsDt).toLocaleDateString()}
            </p>
            <p style={{ fontSize: '0.8em', color: '#6B7280', wordBreak: 'break-all' }}>
              Checklists: {bird.subIds.map((subId, index) => (
                <React.Fragment key={subId}>
                  <a 
                    href={`https://ebird.org/checklist/${subId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3B82F6', textDecoration: 'underline' }}
                  >
                    {subId}
                  </a>
                  {index < bird.subIds.length - 1 ? ', ' : ''}
                </React.Fragment>
              ))}
            </p>
          </div>
        ))}
      </div>
    </>
  );
});

// Component for popup interaction handling
const PopupInteractionHandler = () => {
  const map = useMap();
  
  useEffect(() => {
    const handlePopupOpen = () => {
      if (map.dragging) {
        map.dragging.disable();
        setTimeout(() => map.dragging.enable(), 300);
      }
    };

    map.on('popupopen', handlePopupOpen);
    return () => {
      map.off('popupopen', handlePopupOpen);
    };
  }, [map]);

  return null;
};

// Optimized marker with popup handling
const BirdMarker = memo(({ location, icon }) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  
  const eventHandlers = useCallback({
    popupopen: () => setIsPopupOpen(true),
    popupclose: () => setIsPopupOpen(false),
  }, []);

  return (
    <Marker 
      position={[location.lat, location.lng]}
      icon={icon}
      eventHandlers={eventHandlers}
    >
      <Popup>
        {isPopupOpen && <BirdPopupContent birds={location.birds} />}
      </Popup>
    </Marker>
  );
});

// Component to handle map events
const MapEvents = ({ onMoveEnd }) => {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onMoveEnd(center);
    }
  });
  return null;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const BirdMap = () => {
  const [mapCenter, setMapCenter] = useState({ lat: 36.9741, lng: -122.0308 });
  const [lastQueriedPosition, setLastQueriedPosition] = useState(null);
  const [birdSightings, setBirdSightings] = useState([]);
  const [showUpdateButton, setShowUpdateButton] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [mapRef, setMapRef] = useState(null);
  const inputRef = useRef(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchInput.trim() || !mapRef) return;

    if (inputRef.current) {
      inputRef.current.blur();
      document.body.style.transform = 'scale(1)';
      requestAnimationFrame(() => {
        window.scrollTo({
          top: 0,
          behavior: 'instant'
        });
      });
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchInput)}`
      );
      const data = await response.json();

      if (data && data[0]) {
        const { lat, lon } = data[0];
        mapRef.flyTo([lat, lon], 12);
        setSearchInput('');
      } else {
        alert('Location not found');
      }
    } catch (error) {
      console.error('Error searching location:', error);
      alert('Error searching location');
    }
  };

  const handleCurrentLocation = () => {
    if (!mapRef || !navigator.geolocation) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        mapRef.flyTo([latitude, longitude], 12);
        setTimeout(() => setLocationLoading(false), 1000); // Wait for map movement
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location.  Check your Location Services settings.');
        setLocationLoading(false);

      }
    );
  };

  const handleMoveEnd = useCallback((center) => {
    setMapCenter({ lat: center.lat, lng: center.lng });
      if (lastQueriedPosition) {
         const distance = calculateDistance(
         lastQueriedPosition.lat,
         lastQueriedPosition.lng,
         center.lat,
         center.lng
      );
      setShowUpdateButton(distance >= 10);
      } else {
         setShowUpdateButton(true); // Show on first load
      }
       }, [lastQueriedPosition]);

  const fetchBirdData = async () => {
    setLoading(true);
    try {
      const lat = Number(mapCenter.lat.toFixed(4));
      const lng = Number(mapCenter.lng.toFixed(4));
      
      // Update last queried position before the fetch
      setLastQueriedPosition({ lat, lng });
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/birds?lat=${lat}&lng=${lng}`
      );
  
      if (!response.ok) {
        throw new Error('Failed to fetch bird sightings');
      }
      
      const data = await response.json();
      const validSightings = data.filter(sighting => sighting.obsValid === true);
      const groupedByLocation = _.groupBy(validSightings, sighting => 
        `${sighting.lat},${sighting.lng}`
      );
  
      // Get unique species for photo lookup
      const uniqueSpecies = [...new Set(validSightings.map(
        sighting => `${sighting.sciName}_${sighting.comName}`
      ))];
  
      // Fetch photos for all species at once
      let speciesPhotos = {};
      try {
        const photoResponse = await fetch('https://app.birdweather.com/api/v1/species/lookup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            species: uniqueSpecies,
            fields: ['imageUrl', 'thumbnailUrl']
          })
        });
        
        if (photoResponse.ok) {
          const photoData = await photoResponse.json();
          speciesPhotos = photoData.species;
        }
      } catch (error) {
        console.error('Error fetching species photos:', error);
      }
      
      const processedSightings = Object.entries(groupedByLocation).map(([locationKey, sightings]) => {
        const [lat, lng] = locationKey.split(',').map(Number);
        const birdsBySpecies = _.groupBy(sightings, 'comName');
        
        const birds = Object.entries(birdsBySpecies).map(([comName, speciesSightings]) => {
          const baseData = {
            ...speciesSightings[0],
            subIds: speciesSightings.map(s => s.subId)
          };
  
          // Add photo URLs if available
          const speciesKey = `${baseData.sciName}_${baseData.comName}`;
          const photoData = speciesPhotos[speciesKey];
          if (photoData) {
            baseData.thumbnailUrl = photoData.thumbnailUrl;
            baseData.fullPhotoUrl = photoData.imageUrl;
          }
  
          return baseData;
        });
        
        return {
          lat,
          lng,
          birds
        };
      });
      
      setBirdSightings(processedSightings);
    } catch (error) {
      console.error('Error fetching bird data:', error);
      alert('Error fetching bird sightings');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchBirdData();
  }, []);

  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: 0,
      width: '100%',
      backgroundColor: '#DAD9D9'
    }}>
      <div style={{ 
        padding: '0.5rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        gap: '1rem'
      }}>
                  <button
     type="button"
     onClick={handleCurrentLocation}
     disabled={locationLoading}
     style={{
       padding: '0.5rem 1rem',
       backgroundColor: locationLoading ? '#FD8F47' : '#FD7014',
       color: 'white',
       borderRadius: '0.375rem',
       cursor: locationLoading ? 'not-allowed' : 'pointer'
     }}
   >
     {locationLoading ? 'Loading...' : 'Current Location'}
   </button>
        <form 
          onSubmit={handleSearch}
          style={{ display: 'flex', gap: '0.5rem', flex: 1 }}
        >
          <input
            ref={inputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Location..."
            style={{
              padding: '0.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.375rem',
              flex: 1,
              backgroundColor: 'white',
              color: 'black',
              fontsize: '16px'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#FD7014',
              color: 'white',
              borderRadius: '0.375rem',
              cursor: 'pointer'
            }}
          >
            Go
          </button>
        </form>
      </div>
      
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {showUpdateButton && (
          <button
            onClick={() => {
              fetchBirdData();
              setShowUpdateButton(false);
            }}
            disabled={loading}
            style={{
              position: 'absolute',
              top: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              padding: '0.5rem 1rem',
              backgroundColor: loading ? '#FD8F47' : '#FD7014',
              color: 'white',
              borderRadius: '0.375rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {loading ? 'Fetching...' : 'Update for this area'}
          </button>
        )}
        <MapContainer
          updateWhenZooming={false}
          updateWhenIdle={true}
          center={[36.9741, -122.0308]}
          zoom={12}
          style={{ 
            height: '100%', 
            width: '100%',
            borderRadius: '0.375rem'
          }}
          ref={setMapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors | Data: <a href="https://ebird.org" target="_blank" rel="noopener noreferrer">eBird</a> | Photos: <a href="https://birdweather.com" target="_blank" rel="noopener noreferrer">BirdWeather</a> | &copy; <a href="https://michellestuff.com">Michelle Tomasko</a> | Licensed under <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank" rel="noopener noreferrer">GPL v3</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onMoveEnd={handleMoveEnd} />
          <PopupInteractionHandler />
          
          {birdSightings.map((location, index) => (
            <BirdMarker
              key={`${location.lat}-${location.lng}-${index}`}
              location={location}
              icon={location.birds.length > 1 ? MultipleIcon : DefaultIcon}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default BirdMap;
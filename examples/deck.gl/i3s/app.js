/* global window, fetch, URL */
import React, {PureComponent} from 'react';
import {render} from 'react-dom';
import {StaticMap} from 'react-map-gl';

import {lumaStats} from '@luma.gl/core';
import DeckGL from '@deck.gl/react';
import {MapController, FlyToInterpolator} from '@deck.gl/core';
import {Tile3DLayer} from '@deck.gl/geo-layers';

import {I3SLoader} from '@loaders.gl/i3s';
import {StatsWidget} from '@probe.gl/stats-widget';

import {INITIAL_EXAMPLE_NAME, EXAMPLES} from './examples';
import ControlPanel from './components/control-panel';

// Set your mapbox token here
const MAPBOX_TOKEN = process.env.MapboxAccessToken; // eslint-disable-line

const TRANSITION_DURAITON = 4000;

const INITIAL_VIEW_STATE = {
  longitude: -120,
  latitude: 34,
  height: 600,
  width: 800,
  pitch: 45,
  maxPitch: 60,
  bearing: 0,
  minZoom: 2,
  maxZoom: 30,
  zoom: 14.5
};

const STATS_WIDGET_STYLE = {
  wordBreak: 'break-word',
  position: 'absolute',
  padding: 12,
  zIndex: '10000',
  maxWidth: 300,
  background: '#000',
  color: '#fff'
};

export default class App extends PureComponent {
  constructor(props) {
    super(props);
    this._tilesetStatsWidget = null;
    this.state = {
      url: null,
      token: null,
      name: INITIAL_EXAMPLE_NAME,
      viewState: INITIAL_VIEW_STATE
    };
  }

  componentDidMount() {
    this._memWidget = new StatsWidget(lumaStats.get('Memory Usage'), {
      framesPerUpdate: 1,
      formatters: {
        'GPU Memory': 'memory',
        'Buffer Memory': 'memory',
        'Renderbuffer Memory': 'memory',
        'Texture Memory': 'memory'
      },
      container: this._statsWidgetContainer
    });
    this._tilesetStatsWidget = new StatsWidget(null, {
      container: this._statsWidgetContainer
    });

    // Check if a tileset is specified in the query params
    const {url, token} = this._loadTilesetFromUrl();
    let dataUrl = url || EXAMPLES[INITIAL_EXAMPLE_NAME].url;
    if (token) {
      dataUrl = `${dataUrl}?token=${token}`;
    }

    this.setState({dataUrl, token});
    this._onSelectExample(dataUrl, token);
  }

  _loadTilesetFromUrl() {
    const parsedUrl = new URL(window.location.href);
    return {
      url: parsedUrl.searchParams.get('url'),
      token: parsedUrl.searchParams.get('token')
    };
  }

  async _onSelectExample(url, token) {
    if (!url) {
      return;
    }
    const index = url.lastIndexOf('/layers/0');
    let metadataUrl = url.substring(0, index);
    if (token) {
      metadataUrl = `${metadataUrl}?token=${token}`;
    }
    const metadata = await fetch(metadataUrl).then(resp => resp.json());
    this.setState({metadata});
  }

  // Updates stats, called every frame
  _updateStatWidgets() {
    this._memWidget.update();
    this._tilesetStatsWidget.update();
  }

  _onTilesetLoad(tileset) {
    const {zoom, cartographicCenter} = tileset;
    const [longitude, latitude] = cartographicCenter;

    const viewState = {
      ...this.state.viewState,
      zoom: zoom + 2.5,
      longitude,
      latitude
    };

    this.setState({
      tileset,
      viewState: {
        ...viewState,
        transitionDuration: TRANSITION_DURAITON,
        transitionInterpolator: new FlyToInterpolator()
      }
    });

    this._tilesetStatsWidget.setStats(tileset.stats);
  }

  _onViewStateChange({viewState}) {
    this.setState({viewState});
  }

  _renderLayers() {
    const {dataUrl, token} = this.state;
    const loadOptions = {throttleRequests: true};
    if (token) {
      loadOptions.token = token;
    }
    return [
      new Tile3DLayer({
        data: dataUrl,
        loader: I3SLoader,
        onTilesetLoad: this._onTilesetLoad.bind(this),
        onTileLoad: () => this._updateStatWidgets(),
        onTileUnload: () => this._updateStatWidgets(),
        loadOptions
      })
    ];
  }

  _renderStats() {
    // TODO - too verbose, get more default styling from stats widget?
    return <div style={STATS_WIDGET_STYLE} ref={_ => (this._statsWidgetContainer = _)} />;
  }

  _renderControlPanel() {
    const {tileset, name, metadata} = this.state;
    return (
      <ControlPanel
        tileset={tileset}
        name={name}
        metadata={metadata}
        onExampleChange={selected => {
          this.setState({
            name: selected.name,
            dataUrl: selected.example.url
          });
          this._onSelectExample(selected.example.url);
        }}
      />
    );
  }

  render() {
    const layers = this._renderLayers();
    const {viewState} = this.state;

    return (
      <div style={{position: 'relative', height: '100%'}}>
        {this._renderStats()}
        {this._renderControlPanel()}
        <DeckGL
          ref={_ => (this._deckRef = _)}
          layers={layers}
          viewState={viewState}
          onViewStateChange={this._onViewStateChange.bind(this)}
          controller={{type: MapController, maxPitch: 85}}
          onAfterRender={() => this._updateStatWidgets()}
        >
          <StaticMap
            mapStyle={'mapbox://styles/mapbox/dark-v9'}
            mapboxApiAccessToken={MAPBOX_TOKEN}
            preventStyleDiffing
          />
        </DeckGL>
      </div>
    );
  }
}

export function renderToDOM(container) {
  render(<App />, container);
}

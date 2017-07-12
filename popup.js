// Copyright (c) 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// return k samples chosen uniformly at random from list l
// based on https://en.wikipedia.org/wiki/Reservoir_sampling#Algorithm_R
function reservoirSample(l, k) {
  // just return everything if there's not enough room
  if (l.length < k) {
    return l.slice();
  }

  var ret = l.slice(0, k);
  for (var i = k; i < l.length; i++) {
    var candidate = l[i];
    var j = Math.floor(Math.random() * (i + 1));
    if (j < k) {
      ret[j] = candidate;
    }
  }
  return ret;
}

var folderChain = [];
var urls = [];

// callback for bookmark queries: among the children of the
// current folder, add pure URLs to the url list and add
// folders into the dropdown. Also update the URL count
function updateFolderLists(bookmarkTreeNodes) {
  $('#folders').empty();
  $('#total').empty();
  urls = [];

  // if something went wrong, go back to root
  if (chrome.runtime.lastError) {
    console.log(chrome.runtime.lastError.message);
    folderChain = [];
    refreshState();
    return;
  }

  for (var node of bookmarkTreeNodes) {
    if (node.url) {
      urls.push(node.url);
    } else {
      $('#folders').append($('<option>', {
        value: node.id,
        text: node.title
      }));
    }
  }
  $('#total').html('<strong>' + urls.length + '</strong>');
}

function folderChainToHtml() {
  var chain = ['root'].concat(folderChain.map(function(entry) { return entry.name; }));
  var ret = '';
  for (var i = 0; i < chain.length; i++) {
    if (i == (chain.length - 1)) { // last entry
      ret += '<strong>' + $('<div />').text(chain[i]).html() + '</strong>';
    } else {
      ret += $('<div />').text(chain[i]).html() + ' &rarr; ';
    }
  }
  return ret;
}

function updateFolderChain() {
  $('#parents').empty();
  $('#parents').html(folderChainToHtml());
}

// send state to background script so it can record it
function sendStateToBackground() {
  chrome.runtime.sendMessage({
    'attached' : true, 
    'folderChain' : folderChain,
    'index' : parseInt($('#number').val())
  });
}

function refreshState() {
  // '0' is always ID of root
  var currentId = 
    (folderChain.length == 0) ? '0' : folderChain[folderChain.length - 1].id;

  // check that folder chain is consistent, refresh if not
  if (currentId != '0' && folderChain.length > 1) {
      chrome.bookmarks.get(currentId, function(bookmarkTreeNodes) {
        // something went wrong right away, e.g. bookmark not existing
        // --> go back to root
        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError.message);
          folderChain = [];
          refreshState();
          return;
        }

        // listed parent not consistent with the folder chain array: erase
        // the folder chain and start over
        // smarter behavior would be reconstructing the chain, but that's
        // more trouble than it's worth
        var node = bookmarkTreeNodes[0];
        if (node.parentId != folderChain[folderChain.length - 2].id) {
          folderChain = [];
          refreshState();
          return;
      }
    });
  }

  chrome.bookmarks.getChildren(currentId, updateFolderLists);
  updateFolderChain();
  sendStateToBackground();
}

function initializeNumberSelector() {
  $('#number').empty();
  for (var i = 0; i < 50; i++) {
    $('#number').append($('<option>', {
        value: i + 1,
        text: i + 1
      }));
  }
}

$(function() {
  $('#sample').click(function() {
    var sample = reservoirSample(urls, parseInt($('#number').val()));
    for (var url of sample) {
      chrome.tabs.create({'url': url, 'active': false, 'selected': false});
    }
  });

  $('#up').click(function() {
    if (folderChain.length == 0) { // at the top, nothing to do
      alert('Cannot go up from root');
      return;
    }

    folderChain.pop();
    refreshState();
  });

  $('#down').click(function() {
    // no options to choose from
    if ($('#folders option').length == 0) {
      alert('No folder to descend to');
      return;
    }

    folderChain.push({name: $('#folders option:selected').text(), id: $('#folders').val()});
    refreshState();
  });

  $('#number').change(sendStateToBackground);
});

// always refresh when bookmarks change in a major way, especially in case
// the current folder's been wiped out or moved
chrome.bookmarks.onCreated.addListener(refreshState);
chrome.bookmarks.onRemoved.addListener(refreshState);
chrome.bookmarks.onChanged.addListener(refreshState);
chrome.bookmarks.onMoved.addListener(refreshState);
chrome.bookmarks.onImportEnded.addListener(refreshState);

document.addEventListener('DOMContentLoaded', function () {
  initializeNumberSelector();
  // get the saved folder chain from the backend
  chrome.runtime.sendMessage({'attached': false}, 
    function (response) {
      console.log(response);
      folderChain = response.folderChain.slice();
      $('#number').val(response.index);
      refreshState();
    });
});

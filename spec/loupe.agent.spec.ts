import 'jasmine';
// import mock, { MockRequest, MockResponse } from 'xhr-mock';
import { jasmine } from 'jasmine-ajax';
import { LoupeAgent } from '../src/loupe.agent';


const mockWindow = {
    location: {
        href: "http://localhost:3500/foo",
        origin: ""
    },
    onError: (msg: any, url: string, line: number, column: number, error: string) => { 
        console.log("Window.onError", msg, url, line, column, error);
    }
};
const mockDocument = {
    body: {
        clientHeight: 800,
        clientWidth: 1024
    }
};

describe('wibble', () => {
    // beforeEach(() => mock.setup());
    // afterEach(() => mock.teardown());
    
    beforeEach(() => {jasmine.Ajax.install();});
    afterEach(() => {jasmine.Ajax.uninstall();});

    it('should wobble', done => {
        jasmine.clock().install();
        // spyOn(XMLHttpRequest, "POST").and.re
        // mock.post('http://localhost:3500/', (req: MockRequest, resp: MockResponse) => {
        //     console.log("request called", req);
        //     return resp.status(200).body('');
        // });
        // spyOn(mock, "post");

        // jasmine.createSpy()

        const loupe = new LoupeAgent(mockWindow, mockDocument);
        
        loupe.setCORSOrigin('http://localhost:3500/');
        loupe.information('test', 'test', 'test description');

        
        // waitsFor(() => {
        //     expect(mock.post).toHaveBeenCalledWith('http://localhost:3500/Loupe/log', {});
        //     return true;
        // }, "woo woo", 1000);
        // setTimeout(() => {
        //     expect(mock.post).toHaveBeenCalledWith('http://localhost:3500/Loupe/log', {});
        //     done();
        // }, 1000);

        jasmine.clock().tick(1000);
        expect(mock.post).toHaveBeenCalledWith('http://localhost:3500/loupe/log', {});
        done();
        

        // setTimeout(() => {
        //     expect(mock.post).toHaveBeenCalledWith('http://localhost:3500/Loupe/log', {});
        //     done();
        // }, 1000);

        jasmine.clock().uninstall();
    });
    
});
